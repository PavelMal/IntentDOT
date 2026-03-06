import type { RiskAssessment, RiskLevel } from "./types";

/**
 * Thresholds for risk scoring.
 * Slippage = price impact from Uniswap V2 formula.
 * Liquidity = total reserve value of the output token in the pool.
 */
const SLIPPAGE_YELLOW = 0.03; // 3%
const SLIPPAGE_RED = 0.10;    // 10%
const LIQUIDITY_YELLOW = 1_000; // $1,000 equivalent in output token reserves
const LIQUIDITY_RED = 100;      // $100

export interface PoolState {
  reserveIn: bigint;   // reserve of input token in pool
  reserveOut: bigint;  // reserve of output token in pool
}

/**
 * Calculate Uniswap V2 output amount.
 * amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
 */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * 997n;
  return (amountInWithFee * reserveOut) / (reserveIn * 1000n + amountInWithFee);
}

/**
 * Calculate price impact as a fraction (0.0 - 1.0).
 * Pure price impact from trade size — excludes the 0.3% LP fee.
 * Compares output-with-fee-but-no-impact vs actual output.
 */
export function calculatePriceImpact(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): number {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 1;

  const actualOut = getAmountOut(amountIn, reserveIn, reserveOut);
  if (actualOut <= 0n) return 1;

  // Ideal output at spot price after fee (no pool impact)
  // idealOut = amountIn * 0.997 * reserveOut / reserveIn
  const idealOutAfterFee = (amountIn * 997n * reserveOut) / (reserveIn * 1000n);
  if (idealOutAfterFee <= 0n) return 1;

  const PRECISION = 10n ** 18n;
  const ratio = (actualOut * PRECISION) / idealOutAfterFee;
  const impact = Number(PRECISION - ratio) / Number(PRECISION);

  return Math.max(0, impact);
}

/**
 * Calculate total slippage as a fraction (0.0 - 1.0).
 * Includes both the 0.3% LP fee and price impact from trade size.
 * Compares actual output vs ideal output at spot price (no fee, no impact).
 */
export function calculateSlippage(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): number {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 1;

  const actualOut = getAmountOut(amountIn, reserveIn, reserveOut);
  if (actualOut <= 0n) return 1;

  const idealOut = (amountIn * reserveOut) / reserveIn;
  if (idealOut <= 0n) return 1;

  const PRECISION = 10n ** 18n;
  const ratio = (actualOut * PRECISION) / idealOut;
  const slippage = Number(PRECISION - ratio) / Number(PRECISION);

  return Math.max(0, slippage);
}

/**
 * Assess risk for a swap based on pool state.
 * Returns GREEN / YELLOW / RED with reasons.
 */
export function assessRisk(
  amountIn: bigint,
  pool: PoolState
): RiskAssessment {
  const reasons: string[] = [];
  let worstLevel: RiskLevel = "GREEN";

  const setLevel = (level: RiskLevel) => {
    const priority: Record<RiskLevel, number> = { GREEN: 0, YELLOW: 1, RED: 2 };
    if (priority[level] > priority[worstLevel]) {
      worstLevel = level;
    }
  };

  // 1. Check pool exists / has liquidity
  if (pool.reserveIn <= 0n || pool.reserveOut <= 0n) {
    return {
      level: "RED",
      slippage: 1,
      priceImpact: 1,
      reasons: ["Pool has no liquidity"],
    };
  }

  // 2. Calculate slippage (fee + impact) and pure price impact
  const slippage = calculateSlippage(amountIn, pool.reserveIn, pool.reserveOut);
  const priceImpact = calculatePriceImpact(amountIn, pool.reserveIn, pool.reserveOut);

  if (slippage >= SLIPPAGE_RED) {
    setLevel("RED");
    reasons.push(`Slippage ${(slippage * 100).toFixed(1)}% exceeds 10% — high risk of loss`);
  } else if (slippage >= SLIPPAGE_YELLOW) {
    setLevel("YELLOW");
    reasons.push(`Slippage ${(slippage * 100).toFixed(1)}% is elevated (3-10%)`);
  }

  // 3. Check output reserve depth (liquidity)
  // Convert reserveOut from wei (18 decimals) to human-readable
  const reserveOutHuman = Number(pool.reserveOut) / 1e18;

  if (reserveOutHuman < LIQUIDITY_RED) {
    setLevel("RED");
    reasons.push(`Pool liquidity critically low (${reserveOutHuman.toFixed(0)} tokens)`);
  } else if (reserveOutHuman < LIQUIDITY_YELLOW) {
    setLevel("YELLOW");
    reasons.push(`Pool liquidity is low (${reserveOutHuman.toFixed(0)} tokens)`);
  }

  // 4. Check if swap drains more than 30% of reserves
  const amountOut = getAmountOut(amountIn, pool.reserveIn, pool.reserveOut);
  if (pool.reserveOut > 0n && amountOut > 0n) {
    const drainRatio = Number(amountOut * 100n / pool.reserveOut);
    if (drainRatio > 30) {
      setLevel("RED");
      reasons.push(`Swap would drain ${drainRatio}% of pool reserves`);
    } else if (drainRatio > 10) {
      setLevel("YELLOW");
      reasons.push(`Swap uses ${drainRatio}% of pool reserves`);
    }
  }

  if (reasons.length === 0) {
    reasons.push("Transaction looks safe");
  }

  return {
    level: worstLevel,
    slippage,
    priceImpact,
    reasons,
  };
}

/**
 * Format amountOut from bigint (18 decimals) to human-readable string.
 */
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 4);
  return `${whole}.${fractionStr}`;
}
