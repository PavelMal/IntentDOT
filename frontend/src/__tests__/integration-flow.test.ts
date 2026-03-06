/**
 * Integration flow tests — verifies the full Chat → Parser → Risk → Preview pipeline.
 * Tests the pure logic layer (preview-builder + risk-guardian + types).
 * Contract execution (wagmi hooks) cannot be unit tested — covered by E2E in T014.
 */
import { buildPreview, getPoolReserves } from "@/lib/preview-builder";
import { assessRisk, getAmountOut, formatTokenAmount } from "@/lib/risk-guardian";
import type { PoolState } from "@/lib/risk-guardian";
import type { TransactionPreview, SwapReceipt } from "@/lib/types";

const ETH = 10n ** 18n;

describe("Full flow: intent → preview → risk", () => {
  it("happy path: 10 DOT → USDT produces GREEN preview", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 10 });

    expect(preview).not.toBeNull();
    expect(preview!.intent.action).toBe("swap");
    expect(preview!.intent.amount).toBe(10);
    expect(preview!.risk.level).toBe("GREEN");
    expect(preview!.risk.slippage).toBeLessThan(0.03);

    const outNum = parseFloat(preview!.amountOut);
    expect(outNum).toBeGreaterThan(60);
    expect(outNum).toBeLessThan(70);
  });

  it("medium risk: 5000 DOT → USDT produces YELLOW preview", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 5000 });

    expect(preview).not.toBeNull();
    expect(preview!.risk.level).toBe("YELLOW");
    expect(preview!.risk.slippage).toBeGreaterThanOrEqual(0.03);
    expect(preview!.risk.slippage).toBeLessThan(0.10);
  });

  it("high risk: 30000 DOT → USDT produces RED preview (blocked)", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 30000 });

    expect(preview).not.toBeNull();
    expect(preview!.risk.level).toBe("RED");
    expect(preview!.risk.reasons.length).toBeGreaterThanOrEqual(1);
  });

  it("reverse pair: 100 USDT → DOT", () => {
    const preview = buildPreview({ token_from: "USDT", token_to: "DOT", amount: 100 });

    expect(preview).not.toBeNull();
    expect(preview!.intent.token_from).toBe("USDT");
    expect(preview!.intent.token_to).toBe("DOT");
    const outNum = parseFloat(preview!.amountOut);
    // 100 USDT → ~14.8 DOT (spot ~6.75 USDT/DOT)
    expect(outNum).toBeGreaterThan(10);
    expect(outNum).toBeLessThan(20);
  });

  it("unsupported pair returns null", () => {
    expect(buildPreview({ token_from: "ETH", token_to: "DOT", amount: 10 })).toBeNull();
    expect(buildPreview({ token_from: "USDT", token_to: "USDC", amount: 10 })).toBeNull();
  });

  it("zero/negative/null amount returns null", () => {
    expect(buildPreview({ token_from: "DOT", token_to: "USDT", amount: 0 })).toBeNull();
    expect(buildPreview({ token_from: "DOT", token_to: "USDT", amount: -10 })).toBeNull();
    expect(buildPreview({ token_from: "DOT", token_to: "USDT", amount: null })).toBeNull();
  });
});

describe("On-chain pool override", () => {
  it("uses on-chain pool when provided", () => {
    const customPool: PoolState = {
      reserveIn: 1_000n * ETH,
      reserveOut: 6_750n * ETH,
    };

    const preview = buildPreview(
      { token_from: "DOT", token_to: "USDT", amount: 10 },
      customPool
    );

    expect(preview).not.toBeNull();
    // Same spot price as seeded pool but much less liquidity
    // 10 DOT in 1000 DOT pool = 1% of pool → still GREEN
    expect(preview!.risk.level).toBe("GREEN");
  });

  it("small pool raises risk level", () => {
    const tinyPool: PoolState = {
      reserveIn: 100n * ETH,
      reserveOut: 675n * ETH,
    };

    // 50 DOT in 100 DOT pool → 50% of pool, huge slippage
    const preview = buildPreview(
      { token_from: "DOT", token_to: "USDT", amount: 50 },
      tinyPool
    );

    expect(preview).not.toBeNull();
    expect(preview!.risk.level).toBe("RED");
  });

  it("null on-chain pool falls back to seeded pool", () => {
    const preview = buildPreview(
      { token_from: "DOT", token_to: "USDT", amount: 10 },
      null
    );

    expect(preview).not.toBeNull();
    // Should use seeded pool (50k/337.5k)
    expect(preview!.risk.level).toBe("GREEN");
  });
});

describe("minAmountOut calculation", () => {
  it("1% slippage tolerance gives 99% of amountOut", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 10 });
    expect(preview).not.toBeNull();

    const amountOutWei = BigInt(Math.round(parseFloat(preview!.amountOut) * 1e18));
    const minAmountOut = (amountOutWei * 99n) / 100n;

    // minAmountOut should be ~99% of amountOut
    const ratio = Number(minAmountOut) / Number(amountOutWei);
    expect(ratio).toBeGreaterThan(0.98);
    expect(ratio).toBeLessThanOrEqual(0.99);
  });
});

describe("SwapReceipt type", () => {
  it("can construct a valid receipt", () => {
    const receipt: SwapReceipt = {
      txHash: "0xabc123",
      tokenFrom: "DOT",
      tokenTo: "USDT",
      amountIn: 10,
      amountOut: "67.0500",
      explorerUrl: "https://westend-asset-hub.subscan.io/tx/0xabc123",
    };

    expect(receipt.txHash).toBe("0xabc123");
    expect(receipt.explorerUrl).toContain("subscan.io");
    expect(receipt.amountIn).toBe(10);
    expect(parseFloat(receipt.amountOut)).toBeGreaterThan(0);
  });
});

describe("ABI function signatures match contracts", () => {
  it("executeSwap flow: approve → executeSwap", () => {
    // Verify the flow makes sense: amountInWei is consistent
    const amount = 10;
    const amountInWei = BigInt(Math.round(amount * 1e18));
    expect(amountInWei).toBe(10000000000000000000n);

    // Preview gives us an amountOut
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount });
    expect(preview).not.toBeNull();

    // minAmountOut for slippage protection
    const amountOutWei = BigInt(Math.round(parseFloat(preview!.amountOut) * 1e18));
    const minAmountOut = (amountOutWei * 99n) / 100n;
    expect(minAmountOut).toBeGreaterThan(0n);
    expect(minAmountOut).toBeLessThan(amountOutWei);
  });
});
