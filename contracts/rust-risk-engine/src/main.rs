//! RiskEngine — On-chain risk scoring for IntentDOT
//!
//! A PVM (PolkaVM) smart contract written in Rust that evaluates swap risk
//! using price impact, moving average deviation, and historical volatility.
//! Maintains per-pool price history (ring buffer of 20 prices).
//!
//! Called by IntentExecutor (Solidity) before every swap. RED risk = revert.
//!
//! Solidity interface:
//!   function evaluate(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, address tokenIn, address tokenOut)
//!     external returns (uint8 riskLevel, uint256 score, uint256 priceImpact, uint256 volatility)
//!
//!   function getStats(address tokenIn, address tokenOut)
//!     external view returns (uint256 ma20, uint256 volatility, uint256 tradeCount)

#![no_main]
#![no_std]

use uapi::{HostFn, HostFnImpl as api, ReturnFlags, StorageFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe {
        core::arch::asm!("unimp");
        core::hint::unreachable_unchecked();
    }
}

// ============================================================
// Constants
// ============================================================

/// Basis points scale (100% = 10000)
const BPS: u64 = 10_000;

/// Price history window size
const WINDOW_SIZE: usize = 20;

/// Risk thresholds
const GREEN_MAX: u64 = 39;
const YELLOW_MAX: u64 = 69;

/// Weight factors for composite score (out of 100)
const WEIGHT_IMPACT: u64 = 40;
const WEIGHT_DEVIATION: u64 = 30;
const WEIGHT_VOLATILITY: u64 = 30;

// ============================================================
// Per-pool storage key derivation
// ============================================================

/// Derive a pool identifier from two token addresses (sorted).
/// Returns a 20-byte pool_id from sorted(tokenIn, tokenOut).
fn pool_id(token_a: &[u8; 20], token_b: &[u8; 20]) -> [u8; 20] {
    // Sort addresses to ensure (A,B) == (B,A)
    let (lo, hi) = if token_a < token_b {
        (token_a, token_b)
    } else {
        (token_b, token_a)
    };
    // XOR the two addresses as a simple deterministic combiner
    // Each pool gets a unique 20-byte key since sorted pairs are unique
    let mut id = [0u8; 20];
    let mut i = 0;
    while i < 20 {
        id[i] = lo[i] ^ hi[i];
        // Mix in position to avoid XOR collisions (a^b == c^d)
        id[i] = id[i].wrapping_add(lo[i]).wrapping_add(i as u8);
        i += 1;
    }
    id
}

/// Storage key for price slot: pool_id[0..20] + 0x01 + index as last byte
fn pool_price_key(pid: &[u8; 20], index: usize) -> [u8; 32] {
    let mut k = [0u8; 32];
    k[0..20].copy_from_slice(pid);
    k[20] = 0x01; // price namespace
    k[31] = index as u8;
    k
}

/// Storage key for write index
fn pool_index_key(pid: &[u8; 20]) -> [u8; 32] {
    let mut k = [0u8; 32];
    k[0..20].copy_from_slice(pid);
    k[20] = 0xA0;
    k
}

/// Storage key for trade count
fn pool_count_key(pid: &[u8; 20]) -> [u8; 32] {
    let mut k = [0u8; 32];
    k[0..20].copy_from_slice(pid);
    k[20] = 0xA1;
    k
}

// ============================================================
// Storage helpers
// ============================================================

fn read_u64(key: &[u8; 32]) -> u64 {
    let mut buf = [0u8; 32];
    let mut out = &mut buf[..];
    match api::get_storage(StorageFlags::empty(), key, &mut out) {
        Ok(_) => u64_from_be32(&buf),
        Err(_) => 0,
    }
}

fn write_u64(key: &[u8; 32], val: u64) {
    let mut buf = [0u8; 32];
    buf[24..32].copy_from_slice(&val.to_be_bytes());
    api::set_storage(StorageFlags::empty(), key, &buf);
}

/// Decode u64 from last 8 bytes of a 32-byte big-endian buffer
fn u64_from_be32(buf: &[u8; 32]) -> u64 {
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&buf[24..32]);
    u64::from_be_bytes(bytes)
}

/// Decode u128 from a 32-byte ABI-encoded calldata chunk
fn decode_u128(calldata: &[u8], offset: usize) -> u128 {
    let start = offset + 16;
    if start + 16 > calldata.len() {
        return 0;
    }
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&calldata[start..start + 16]);
    u128::from_be_bytes(bytes)
}

/// Decode address (20 bytes) from a 32-byte ABI-encoded calldata chunk
fn decode_address(calldata: &[u8], offset: usize) -> [u8; 20] {
    let start = offset + 12; // address is right-aligned in 32 bytes
    let mut addr = [0u8; 20];
    if start + 20 <= calldata.len() {
        addr.copy_from_slice(&calldata[start..start + 20]);
    }
    addr
}

// ============================================================
// Math helpers
// ============================================================

/// Integer square root (Babylonian method)
fn isqrt(n: u64) -> u64 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

/// Absolute difference
fn abs_diff(a: u64, b: u64) -> u64 {
    if a > b { a - b } else { b - a }
}

// ============================================================
// Risk computation (per-pool)
// ============================================================

/// Calculate price impact in basis points for constant-product AMM with 0.3% fee
fn calc_price_impact(amount_in: u128, reserve_in: u128) -> u64 {
    if reserve_in == 0 || amount_in == 0 {
        return BPS;
    }
    let numer = 3u128 * reserve_in + 997u128 * amount_in;
    let denom = 1000u128 * reserve_in + 997u128 * amount_in;
    if denom == 0 {
        return BPS;
    }
    (numer * BPS as u128 / denom) as u64
}

/// Calculate MA20 from stored price history for a specific pool
fn calc_ma20(pid: &[u8; 20]) -> u64 {
    let count_key = pool_count_key(pid);
    let count = read_u64(&count_key);
    let n = if count < WINDOW_SIZE as u64 { count } else { WINDOW_SIZE as u64 };
    if n == 0 {
        return 0;
    }
    let mut sum: u64 = 0;
    for i in 0..n as usize {
        sum = sum.saturating_add(read_u64(&pool_price_key(pid, i)));
    }
    sum / n
}

/// Calculate volatility (standard deviation) in basis points for a specific pool
fn calc_volatility(pid: &[u8; 20]) -> u64 {
    let count_key = pool_count_key(pid);
    let count = read_u64(&count_key);
    let n = if count < WINDOW_SIZE as u64 { count } else { WINDOW_SIZE as u64 };
    if n < 2 {
        return 0;
    }

    let ma = calc_ma20(pid);
    if ma == 0 {
        return 0;
    }

    let mut variance_sum: u64 = 0;
    for i in 0..n as usize {
        let price = read_u64(&pool_price_key(pid, i));
        let diff = abs_diff(price, ma);
        variance_sum = variance_sum.saturating_add(diff.saturating_mul(diff) / BPS);
    }
    let variance = variance_sum / n;
    isqrt(variance.saturating_mul(BPS))
}

/// Store current spot price in ring buffer for a specific pool.
/// Price is always recorded as reserve_hi / reserve_lo (canonical direction)
/// to ensure consistent pricing regardless of swap direction.
fn record_price(pid: &[u8; 20], reserve_lo: u128, reserve_hi: u128) {
    if reserve_lo == 0 {
        return;
    }
    let price_bps = ((reserve_hi * BPS as u128) / reserve_lo) as u64;

    let idx_key = pool_index_key(pid);
    let index = read_u64(&idx_key) as usize % WINDOW_SIZE;
    write_u64(&pool_price_key(pid, index), price_bps);

    let new_index = (index + 1) % WINDOW_SIZE;
    write_u64(&idx_key, new_index as u64);

    let cnt_key = pool_count_key(pid);
    let count = read_u64(&cnt_key);
    if count < WINDOW_SIZE as u64 {
        write_u64(&cnt_key, count + 1);
    }
}

/// Evaluate swap risk for a specific pool.
/// token_in and token_out are used to normalize price direction:
/// price is always recorded as reserve(higher_addr) / reserve(lower_addr).
fn evaluate(amount_in: u128, reserve_in: u128, reserve_out: u128, token_in: &[u8; 20], token_out: &[u8; 20], pid: &[u8; 20]) -> (u8, u64, u64, u64) {
    let price_impact = calc_price_impact(amount_in, reserve_in);
    let ma = calc_ma20(pid);
    let volatility = calc_volatility(pid);

    // Normalize: always compute price as reserve(hi_addr) / reserve(lo_addr)
    let (reserve_lo, reserve_hi) = if token_in < token_out {
        (reserve_in, reserve_out)
    } else {
        (reserve_out, reserve_in)
    };

    let current_price_bps = if reserve_lo > 0 {
        ((reserve_hi * BPS as u128) / reserve_lo) as u64
    } else {
        0
    };
    let deviation = if ma > 0 {
        abs_diff(current_price_bps, ma) * BPS / ma
    } else {
        0
    };

    let impact_score = if price_impact >= 1000 { 100 } else { price_impact / 10 };
    let dev_score = if deviation >= 1000 { 100 } else { deviation / 10 };
    let vol_score = if volatility >= 1000 { 100 } else { volatility / 10 };

    let composite = (impact_score * WEIGHT_IMPACT + dev_score * WEIGHT_DEVIATION + vol_score * WEIGHT_VOLATILITY) / 100;

    record_price(pid, reserve_lo, reserve_hi);

    let risk_level = if composite <= GREEN_MAX {
        0
    } else if composite <= YELLOW_MAX {
        1
    } else {
        2
    };

    (risk_level, composite, price_impact, volatility)
}

// ============================================================
// Entry points
// ============================================================

#[no_mangle]
#[polkavm_derive::polkavm_export]
pub extern "C" fn deploy() {}

#[no_mangle]
#[polkavm_derive::polkavm_export]
pub extern "C" fn call() {
    let len = api::call_data_size();
    if len < 4 {
        api::return_value(ReturnFlags::REVERT, b"Input too short");
    }

    let mut selector = [0u8; 4];
    api::call_data_copy(&mut selector, 0);

    // evaluate(uint256,uint256,uint256,address,address) = 0xabb0e06c
    if selector == [0xab, 0xb0, 0xe0, 0x6c] {
        // Calldata: 4 + 32*3 + 32*2 = 164 bytes
        if len < 164 {
            api::return_value(ReturnFlags::REVERT, b"Invalid calldata length");
        }
        let mut calldata = [0u8; 164];
        api::call_data_copy(&mut calldata, 0);

        let amount_in = decode_u128(&calldata, 4);
        let reserve_in = decode_u128(&calldata, 36);
        let reserve_out = decode_u128(&calldata, 68);
        let token_in = decode_address(&calldata, 100);
        let token_out = decode_address(&calldata, 132);

        let pid = pool_id(&token_in, &token_out);
        let (risk_level, score, price_impact, volatility) = evaluate(amount_in, reserve_in, reserve_out, &token_in, &token_out, &pid);

        let mut output = [0u8; 128];
        output[31] = risk_level;
        output[56..64].copy_from_slice(&score.to_be_bytes());
        output[88..96].copy_from_slice(&price_impact.to_be_bytes());
        output[120..128].copy_from_slice(&volatility.to_be_bytes());

        api::return_value(ReturnFlags::empty(), &output);
    }
    // getStats(address,address) = 0x84dfb9ed
    else if selector == [0x84, 0xdf, 0xb9, 0xed] {
        if len < 68 {
            api::return_value(ReturnFlags::REVERT, b"Invalid calldata length");
        }
        let mut calldata = [0u8; 68];
        api::call_data_copy(&mut calldata, 0);

        let token_in = decode_address(&calldata, 4);
        let token_out = decode_address(&calldata, 36);
        let pid = pool_id(&token_in, &token_out);

        let ma = calc_ma20(&pid);
        let vol = calc_volatility(&pid);
        let count = read_u64(&pool_count_key(&pid));

        let mut output = [0u8; 96];
        output[24..32].copy_from_slice(&ma.to_be_bytes());
        output[56..64].copy_from_slice(&vol.to_be_bytes());
        output[88..96].copy_from_slice(&count.to_be_bytes());

        api::return_value(ReturnFlags::empty(), &output);
    } else {
        api::return_value(ReturnFlags::REVERT, b"Unknown selector");
    }
}
