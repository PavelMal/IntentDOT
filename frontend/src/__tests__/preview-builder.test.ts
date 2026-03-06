import { buildPreview, buildTransferPreview, buildTokenCreatePreview, getPoolReserves } from "@/lib/preview-builder";

describe("getPoolReserves", () => {
  it("returns pool for DOT-USDT", () => {
    const pool = getPoolReserves("DOT", "USDT");
    expect(pool).not.toBeNull();
    expect(pool!.reserveIn).toBeGreaterThan(0n);
    expect(pool!.reserveOut).toBeGreaterThan(0n);
  });

  it("returns pool for reverse pair USDT-DOT", () => {
    const pool = getPoolReserves("USDT", "DOT");
    expect(pool).not.toBeNull();
  });

  it("returns pool for DOT-USDC", () => {
    const pool = getPoolReserves("DOT", "USDC");
    expect(pool).not.toBeNull();
  });

  it("returns null for unsupported pair", () => {
    expect(getPoolReserves("USDT", "USDC")).toBeNull();
    expect(getPoolReserves("ETH", "DOT")).toBeNull();
  });
});

describe("buildPreview", () => {
  it("returns preview for valid small swap", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 10 });
    expect(preview).not.toBeNull();
    expect(preview!.intent.token_from).toBe("DOT");
    expect(preview!.intent.token_to).toBe("USDT");
    expect(preview!.intent.amount).toBe(10);
    expect(preview!.risk.level).toBe("GREEN");
    // 10 DOT in a 50K/337.5K pool → ~67.5 USDT
    const amountOutNum = parseFloat(preview!.amountOut);
    expect(amountOutNum).toBeGreaterThan(60);
    expect(amountOutNum).toBeLessThan(70);
  });

  it("returns GREEN risk for small amount", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 1 });
    expect(preview).not.toBeNull();
    expect(preview!.risk.level).toBe("GREEN");
    expect(preview!.risk.slippage).toBeLessThan(0.03);
  });

  it("returns YELLOW risk for moderate amount", () => {
    // 5000 DOT in 50K pool = 10% of pool
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 5000 });
    expect(preview).not.toBeNull();
    expect(preview!.risk.level).toBe("YELLOW");
  });

  it("returns RED risk for huge amount", () => {
    // 30000 DOT in 50K pool = 60% of pool
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 30000 });
    expect(preview).not.toBeNull();
    expect(preview!.risk.level).toBe("RED");
  });

  it("returns null for zero amount", () => {
    expect(buildPreview({ token_from: "DOT", token_to: "USDT", amount: 0 })).toBeNull();
  });

  it("returns null for negative amount", () => {
    expect(buildPreview({ token_from: "DOT", token_to: "USDT", amount: -5 })).toBeNull();
  });

  it("returns null for null amount", () => {
    expect(buildPreview({ token_from: "DOT", token_to: "USDT", amount: null })).toBeNull();
  });

  it("returns null for unsupported token pair", () => {
    expect(buildPreview({ token_from: "ETH", token_to: "USDT", amount: 10 })).toBeNull();
  });

  it("works for reverse pair USDC-DOT", () => {
    const preview = buildPreview({ token_from: "USDC", token_to: "DOT", amount: 100 });
    expect(preview).not.toBeNull();
    expect(preview!.intent.token_from).toBe("USDC");
    expect(preview!.intent.token_to).toBe("DOT");
    // 100 USDC → ~14.8 DOT (spot price 6.75)
    const amountOutNum = parseFloat(preview!.amountOut);
    expect(amountOutNum).toBeGreaterThan(10);
    expect(amountOutNum).toBeLessThan(20);
  });

  it("amountOut is a formatted string with decimals", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 10 });
    expect(preview).not.toBeNull();
    // Should match format "XX.XXXX"
    expect(preview!.amountOut).toMatch(/^\d+\.\d{4}$/);
  });

  it("preview has correct intent action", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 10 });
    expect(preview!.intent.action).toBe("swap");
  });

  it("preview has token addresses", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 10 });
    expect(preview).not.toBeNull();
    expect(typeof preview!.tokenInAddress).toBe("string");
    expect(typeof preview!.tokenOutAddress).toBe("string");
  });

  it("risk assessment includes reasons", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 10 });
    expect(preview!.risk.reasons.length).toBeGreaterThan(0);
  });

  it("fractional amounts work correctly", () => {
    const preview = buildPreview({ token_from: "DOT", token_to: "USDT", amount: 0.5 });
    expect(preview).not.toBeNull();
    const amountOutNum = parseFloat(preview!.amountOut);
    // 0.5 DOT → ~3.375 USDT
    expect(amountOutNum).toBeGreaterThan(3);
    expect(amountOutNum).toBeLessThan(4);
  });
});

describe("buildTransferPreview", () => {
  it("returns preview for valid transfer", () => {
    const preview = buildTransferPreview({
      action: "transfer",
      token_from: "DOT",
      token_to: "",
      amount: 50,
      recipient: "0x1234567890abcdef1234567890abcdef12345678",
    });
    expect(preview).not.toBeNull();
    expect(preview!.intent.action).toBe("transfer");
    expect(preview!.intent.amount).toBe(50);
    expect(preview!.intent.recipient).toBe("0x1234567890abcdef1234567890abcdef12345678");
  });

  it("returns null for zero amount", () => {
    expect(buildTransferPreview({
      action: "transfer", token_from: "DOT", token_to: "", amount: 0,
      recipient: "0x1234567890abcdef1234567890abcdef12345678",
    })).toBeNull();
  });

  it("returns null for missing recipient", () => {
    expect(buildTransferPreview({
      action: "transfer", token_from: "DOT", token_to: "", amount: 10,
    })).toBeNull();
  });

  it("returns null for unsupported token", () => {
    expect(buildTransferPreview({
      action: "transfer", token_from: "ETH", token_to: "", amount: 10,
      recipient: "0x1234567890abcdef1234567890abcdef12345678",
    })).toBeNull();
  });
});

describe("buildTokenCreatePreview", () => {
  it("returns preview for valid create_token", () => {
    const preview = buildTokenCreatePreview({
      action: "create_token", token_from: "", token_to: "", amount: null,
      tokenName: "PEPE", tokenSymbol: "PEPE", initialSupply: 1000000,
    });
    expect(preview).not.toBeNull();
    expect(preview!.intent.action).toBe("create_token");
    expect(preview!.intent.tokenName).toBe("PEPE");
    expect(preview!.intent.tokenSymbol).toBe("PEPE");
    expect(preview!.intent.initialSupply).toBe(1000000);
  });

  it("returns null for missing name", () => {
    expect(buildTokenCreatePreview({
      action: "create_token", token_from: "", token_to: "", amount: null,
      tokenSymbol: "PEPE", initialSupply: 1000000,
    })).toBeNull();
  });

  it("returns null for missing supply", () => {
    expect(buildTokenCreatePreview({
      action: "create_token", token_from: "", token_to: "", amount: null,
      tokenName: "PEPE", tokenSymbol: "PEPE",
    })).toBeNull();
  });
});
