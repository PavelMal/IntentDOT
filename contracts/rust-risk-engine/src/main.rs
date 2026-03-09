//! RiskEngine — On-chain risk scoring for IntentDOT
//!
//! A PVM (PolkaVM) smart contract written in Rust that evaluates swap risk
//! using price impact, moving average deviation, and historical volatility.
//!
//! Called by IntentExecutor (Solidity) before every swap. RED risk = revert.
//!
//! Solidity interface:
//!   function evaluate(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
//!     external returns (uint8 riskLevel, uint256 score, uint256 priceImpact, uint256 volatility)
//!
//!   function getStats() external view returns (uint256 ma20, uint256 volatility, uint256 tradeCount)

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

/// Risk thresholds (basis points)
const GREEN_MAX: u64 = 39;
const YELLOW_MAX: u64 = 69;

/// Weight factors for composite score (out of 100)
const WEIGHT_IMPACT: u64 = 40;
const WEIGHT_DEVIATION: u64 = 30;
const WEIGHT_VOLATILITY: u64 = 30;

// ============================================================
// Storage keys (32-byte)
// ============================================================

/// Storage key for price ring buffer: 20 slots at keys 0x01..0x14
/// Each slot stores a u64 price in basis points
const PRICE_BASE_KEY: u8 = 0x01;

/// Storage key for write index (0..19)
const INDEX_KEY: [u8; 32] = key(0xA0);

/// Storage key for trade count
const COUNT_KEY: [u8; 32] = key(0xA1);

/// Helper: create a 32-byte storage key from a single byte tag
const fn key(tag: u8) -> [u8; 32] {
    let mut k = [0u8; 32];
    k[31] = tag;
    k
}

/// Helper: create price slot key from index (0..19)
const fn price_key(index: usize) -> [u8; 32] {
    let mut k = [0u8; 32];
    k[31] = PRICE_BASE_KEY + index as u8;
    k
}

// ============================================================
// Selectors (keccak256 first 4 bytes)
// ============================================================

/// evaluate(uint256,uint256,uint256) → keccak256 = 0x7af23a7f
const SEL_EVALUATE: [u8; 4] = [0x7a, 0xf2, 0x3a, 0x7f];

/// getStats() → keccak256 = 0xc59d4847
const SEL_GET_STATS: [u8; 4] = [0xc5, 0x9d, 0x48, 0x47];

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
/// Reads last 16 bytes to support values up to ~3.4e38 (handles wei amounts)
fn decode_u128(calldata: &[u8], offset: usize) -> u128 {
    let start = offset + 16; // last 16 bytes of 32-byte word
    if start + 16 > calldata.len() {
        return 0;
    }
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&calldata[start..start + 16]);
    u128::from_be_bytes(bytes)
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
// Risk computation
// ============================================================

/// Calculate price impact in basis points for constant-product AMM with 0.3% fee
/// Simplified formula that avoids u128 overflow:
///   impact_bps = (3 * reserveIn + 997 * amountIn) * BPS / (1000 * reserveIn + 997 * amountIn)
/// This captures both slippage and fee impact.
fn calc_price_impact(amount_in: u128, reserve_in: u128, _reserve_out: u128) -> u64 {
    if reserve_in == 0 || amount_in == 0 {
        return BPS; // 100% impact = max risk
    }

    // fee_component = 3 * reserveIn (from 0.3% fee)
    // slippage_component = 997 * amountIn (from pool depth)
    let numer = 3u128 * reserve_in + 997u128 * amount_in;
    let denom = 1000u128 * reserve_in + 997u128 * amount_in;

    if denom == 0 {
        return BPS;
    }

    (numer * BPS as u128 / denom) as u64
}

/// Calculate MA20 from stored price history
fn calc_ma20() -> u64 {
    let count = read_u64(&COUNT_KEY);
    let n = if count < WINDOW_SIZE as u64 { count } else { WINDOW_SIZE as u64 };
    if n == 0 {
        return 0;
    }
    let mut sum: u64 = 0;
    for i in 0..n as usize {
        sum = sum.saturating_add(read_u64(&price_key(i)));
    }
    sum / n
}

/// Calculate volatility (standard deviation) in basis points
fn calc_volatility() -> u64 {
    let count = read_u64(&COUNT_KEY);
    let n = if count < WINDOW_SIZE as u64 { count } else { WINDOW_SIZE as u64 };
    if n < 2 {
        return 0;
    }

    let ma = calc_ma20();
    if ma == 0 {
        return 0;
    }

    // Variance = sum((price - ma)^2) / n
    let mut variance_sum: u64 = 0;
    for i in 0..n as usize {
        let price = read_u64(&price_key(i));
        let diff = abs_diff(price, ma);
        // Scale down to avoid overflow: diff is in BPS range
        variance_sum = variance_sum.saturating_add(diff.saturating_mul(diff) / BPS);
    }
    let variance = variance_sum / n;

    // Stddev = sqrt(variance) * sqrt(BPS) to get back to BPS scale
    // Actually: stddev_bps = sqrt(variance * BPS)
    isqrt(variance.saturating_mul(BPS))
}

/// Store current spot price in ring buffer
fn record_price(reserve_in: u128, reserve_out: u128) {
    if reserve_in == 0 {
        return;
    }
    let price_bps = ((reserve_out * BPS as u128) / reserve_in) as u64;

    let index = read_u64(&INDEX_KEY) as usize % WINDOW_SIZE;
    write_u64(&price_key(index), price_bps);

    let new_index = (index + 1) % WINDOW_SIZE;
    write_u64(&INDEX_KEY, new_index as u64);

    let count = read_u64(&COUNT_KEY);
    if count < WINDOW_SIZE as u64 {
        write_u64(&COUNT_KEY, count + 1);
    }
}

/// Evaluate swap risk
/// Returns: (risk_level, composite_score, price_impact_bps, volatility_bps)
///   risk_level: 0=GREEN, 1=YELLOW, 2=RED
fn evaluate(amount_in: u128, reserve_in: u128, reserve_out: u128) -> (u8, u64, u64, u64) {
    let price_impact = calc_price_impact(amount_in, reserve_in, reserve_out);
    let ma = calc_ma20();
    let volatility = calc_volatility();

    // MA deviation: how far current spot price is from MA20
    let current_price_bps = if reserve_in > 0 {
        ((reserve_out * BPS as u128) / reserve_in) as u64
    } else {
        0
    };
    let deviation = if ma > 0 {
        abs_diff(current_price_bps, ma) * BPS / ma
    } else {
        0
    };

    // Normalize components to 0-100 scale
    // price_impact: 0bps=0, 500bps(5%)=50, 1000bps(10%)=100
    let impact_score = if price_impact >= 1000 { 100 } else { price_impact / 10 };
    // deviation: 0bps=0, 500bps=50, 1000bps=100
    let dev_score = if deviation >= 1000 { 100 } else { deviation / 10 };
    // volatility: 0bps=0, 500bps=50, 1000bps=100
    let vol_score = if volatility >= 1000 { 100 } else { volatility / 10 };

    // Weighted composite score (0-100)
    let composite = (impact_score * WEIGHT_IMPACT + dev_score * WEIGHT_DEVIATION + vol_score * WEIGHT_VOLATILITY) / 100;

    // Record price for future MA/volatility calculations
    record_price(reserve_in, reserve_out);

    // Determine risk level
    let risk_level = if composite <= GREEN_MAX {
        0 // GREEN
    } else if composite <= YELLOW_MAX {
        1 // YELLOW
    } else {
        2 // RED
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

    // Read selector (first 4 bytes)
    let mut selector = [0u8; 4];
    api::call_data_copy(&mut selector, 0);

    match selector {
        SEL_EVALUATE => {
            // evaluate(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
            // Calldata: 4 + 32 + 32 + 32 = 100 bytes
            if len < 100 {
                api::return_value(ReturnFlags::REVERT, b"Invalid calldata length");
            }
            let mut calldata = [0u8; 100];
            api::call_data_copy(&mut calldata, 0);

            let amount_in = decode_u128(&calldata, 4);
            let reserve_in = decode_u128(&calldata, 36);
            let reserve_out = decode_u128(&calldata, 68);

            let (risk_level, score, price_impact, volatility) = evaluate(amount_in, reserve_in, reserve_out);

            // ABI encode return: 4 x uint256 = 128 bytes
            let mut output = [0u8; 128];
            // risk_level (uint8 padded to uint256)
            output[31] = risk_level;
            // score
            output[56..64].copy_from_slice(&score.to_be_bytes());
            // price_impact
            output[88..96].copy_from_slice(&price_impact.to_be_bytes());
            // volatility
            output[120..128].copy_from_slice(&volatility.to_be_bytes());

            api::return_value(ReturnFlags::empty(), &output);
        }
        SEL_GET_STATS => {
            // getStats() → (uint256 ma20, uint256 volatility, uint256 tradeCount)
            let ma = calc_ma20();
            let vol = calc_volatility();
            let count = read_u64(&COUNT_KEY);

            let mut output = [0u8; 96];
            output[24..32].copy_from_slice(&ma.to_be_bytes());
            output[56..64].copy_from_slice(&vol.to_be_bytes());
            output[88..96].copy_from_slice(&count.to_be_bytes());

            api::return_value(ReturnFlags::empty(), &output);
        }
        _ => {
            api::return_value(ReturnFlags::REVERT, b"Unknown selector");
        }
    }
}
