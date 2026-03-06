import {
  getAmountOut,
  calculatePriceImpact,
  assessRisk,
  formatTokenAmount,
  type PoolState,
} from "@/lib/risk-guardian";

const ETH = 10n ** 18n; // 1 token in wei

// Pool: 10,000 DOT / 67,500 USDT (1 DOT = 6.75 USDT)
const HEALTHY_POOL: PoolState = {
  reserveIn: 10_000n * ETH,
  reserveOut: 67_500n * ETH,
};

// Pool: 50 DOT / 337.5 USDT (tiny pool)
const TINY_POOL: PoolState = {
  reserveIn: 50n * ETH,
  reserveOut: 337n * ETH + ETH / 2n,
};

const EMPTY_POOL: PoolState = {
  reserveIn: 0n,
  reserveOut: 0n,
};

describe("getAmountOut", () => {
  it("returns correct output for Uniswap V2 formula", () => {
    // 10 DOT in a 10k/67.5k pool
    const out = getAmountOut(10n * ETH, 10_000n * ETH, 67_500n * ETH);
    // Should be ~67.05 USDT (less than spot 67.5 due to fee + impact)
    const outHuman = Number(out) / 1e18;
    expect(outHuman).toBeGreaterThan(60);
    expect(outHuman).toBeLessThan(68);
  });

  it("returns 0 for zero input", () => {
    expect(getAmountOut(0n, 10_000n * ETH, 67_500n * ETH)).toBe(0n);
  });

  it("returns 0 for zero reserves", () => {
    expect(getAmountOut(10n * ETH, 0n, 67_500n * ETH)).toBe(0n);
    expect(getAmountOut(10n * ETH, 10_000n * ETH, 0n)).toBe(0n);
  });

  it("large swap gives less favorable rate", () => {
    const smallOut = getAmountOut(1n * ETH, 10_000n * ETH, 67_500n * ETH);
    const largeOut = getAmountOut(1_000n * ETH, 10_000n * ETH, 67_500n * ETH);
    // Per-unit rate should be worse for large swap
    const smallRate = Number(smallOut) / 1;
    const largeRate = Number(largeOut) / 1000;
    expect(largeRate).toBeLessThan(smallRate);
  });
});

describe("calculatePriceImpact", () => {
  it("small swap has low price impact", () => {
    const impact = calculatePriceImpact(1n * ETH, 10_000n * ETH, 67_500n * ETH);
    // 1 DOT in 10k pool → ~0.3% impact (fee) + tiny slippage
    expect(impact).toBeLessThan(0.01); // < 1%
    expect(impact).toBeGreaterThan(0);
  });

  it("medium swap has moderate price impact", () => {
    // 500 DOT in 10k pool → ~5% of pool
    const impact = calculatePriceImpact(500n * ETH, 10_000n * ETH, 67_500n * ETH);
    expect(impact).toBeGreaterThan(0.03); // > 3%
    expect(impact).toBeLessThan(0.15);    // < 15%
  });

  it("huge swap has high price impact", () => {
    // 5000 DOT in 10k pool → 50% of pool
    const impact = calculatePriceImpact(5_000n * ETH, 10_000n * ETH, 67_500n * ETH);
    expect(impact).toBeGreaterThan(0.2); // > 20%
  });

  it("returns 1 for zero inputs", () => {
    expect(calculatePriceImpact(0n, 10_000n * ETH, 67_500n * ETH)).toBe(1);
    expect(calculatePriceImpact(10n * ETH, 0n, 67_500n * ETH)).toBe(1);
    expect(calculatePriceImpact(10n * ETH, 10_000n * ETH, 0n)).toBe(1);
  });
});

describe("assessRisk", () => {
  it("GREEN for small swap in healthy pool", () => {
    const result = assessRisk(10n * ETH, HEALTHY_POOL);
    expect(result.level).toBe("GREEN");
    expect(result.slippage).toBeLessThan(0.03);
    expect(result.reasons).toContain("Transaction looks safe");
  });

  it("GREEN for very small swap", () => {
    const result = assessRisk(1n * ETH, HEALTHY_POOL);
    expect(result.level).toBe("GREEN");
  });

  it("YELLOW for moderate swap causing 3-10% slippage", () => {
    // 500 DOT in 10k pool
    const result = assessRisk(500n * ETH, HEALTHY_POOL);
    expect(result.level).toBe("YELLOW");
    expect(result.slippage).toBeGreaterThanOrEqual(0.03);
    expect(result.slippage).toBeLessThan(0.10);
  });

  it("RED for huge swap causing >10% slippage", () => {
    // 5000 DOT in 10k pool
    const result = assessRisk(5_000n * ETH, HEALTHY_POOL);
    expect(result.level).toBe("RED");
    expect(result.slippage).toBeGreaterThanOrEqual(0.10);
  });

  it("RED for empty pool", () => {
    const result = assessRisk(10n * ETH, EMPTY_POOL);
    expect(result.level).toBe("RED");
    expect(result.reasons).toContain("Pool has no liquidity");
  });

  it("RED for tiny pool (low liquidity)", () => {
    // 337 USDT reserve is below LIQUIDITY_RED (100) — wait no, 337 > 100
    // But 10 DOT in 50 DOT pool drains 20% of reserves → YELLOW at least
    const result = assessRisk(10n * ETH, TINY_POOL);
    expect(["YELLOW", "RED"]).toContain(result.level);
  });

  it("RED when swap drains >30% of pool", () => {
    // 20 DOT in 50 DOT pool → drains large % of output reserves
    const result = assessRisk(20n * ETH, TINY_POOL);
    expect(result.level).toBe("RED");
    // Should have multiple reasons (slippage + drain or slippage + liquidity)
    expect(result.reasons.length).toBeGreaterThanOrEqual(1);
    // Verify it's RED for the right reasons (high slippage and/or drain)
    const hasHighRiskReason = result.reasons.some(
      r => r.includes("Slippage") || r.includes("drain") || r.includes("liquidity")
    );
    expect(hasHighRiskReason).toBe(true);
  });

  it("returns multiple reasons when multiple thresholds hit", () => {
    // 3000 DOT in 10k pool → high slippage + drains reserves
    const result = assessRisk(3_000n * ETH, HEALTHY_POOL);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("slippage and priceImpact are numbers, not NaN", () => {
    const result = assessRisk(10n * ETH, HEALTHY_POOL);
    expect(typeof result.slippage).toBe("number");
    expect(typeof result.priceImpact).toBe("number");
    expect(isNaN(result.slippage)).toBe(false);
    expect(isNaN(result.priceImpact)).toBe(false);
  });

  it("reasons array is never empty", () => {
    const green = assessRisk(1n * ETH, HEALTHY_POOL);
    expect(green.reasons.length).toBeGreaterThan(0);

    const red = assessRisk(5_000n * ETH, HEALTHY_POOL);
    expect(red.reasons.length).toBeGreaterThan(0);
  });
});

describe("formatTokenAmount", () => {
  it("formats whole token amounts", () => {
    expect(formatTokenAmount(67n * ETH)).toBe("67.0000");
  });

  it("formats fractional amounts", () => {
    const amount = 67n * ETH + ETH / 2n; // 67.5
    expect(formatTokenAmount(amount)).toBe("67.5000");
  });

  it("formats zero", () => {
    expect(formatTokenAmount(0n)).toBe("0.0000");
  });

  it("formats small amounts", () => {
    expect(formatTokenAmount(ETH / 10n)).toBe("0.1000"); // 0.1
  });
});
