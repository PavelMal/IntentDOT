import { CONTRACTS, TOKEN_MAP } from "../lib/contracts";
import { isAddress } from "viem";

describe("CONTRACTS config", () => {
  const contractNames = Object.keys(CONTRACTS) as (keyof typeof CONTRACTS)[];

  it("exports all required contract keys", () => {
    expect(contractNames).toEqual(
      expect.arrayContaining([
        "intentExecutor",
        "mockDex",
        "dotToken",
        "usdtToken",
        "usdcToken",
        "tokenFactory",
      ])
    );
  });

  it.each(contractNames)("%s is a valid Ethereum address", (name) => {
    expect(isAddress(CONTRACTS[name])).toBe(true);
  });

  it.each(contractNames)("%s is checksummed or zero address", (name) => {
    const addr = CONTRACTS[name];
    const isZero = addr === "0x0000000000000000000000000000000000000000";
    const isChecksumValid = isAddress(addr, { strict: true });
    expect(isZero || isChecksumValid).toBe(true);
  });

  it("has no duplicate addresses (except zero)", () => {
    const nonZero = Object.values(CONTRACTS).filter(
      (a) => a !== "0x0000000000000000000000000000000000000000"
    );
    expect(new Set(nonZero).size).toBe(nonZero.length);
  });
});

describe("TOKEN_MAP", () => {
  const tokens = Object.keys(TOKEN_MAP);

  it("contains DOT, USDT, USDC", () => {
    expect(tokens).toEqual(expect.arrayContaining(["DOT", "USDT", "USDC"]));
  });

  it.each(tokens)("%s has valid address", (symbol) => {
    expect(isAddress(TOKEN_MAP[symbol].address)).toBe(true);
  });

  it.each(tokens)("%s has 18 decimals", (symbol) => {
    expect(TOKEN_MAP[symbol].decimals).toBe(18);
  });

  it.each(tokens)("%s symbol matches key", (symbol) => {
    expect(TOKEN_MAP[symbol].symbol).toBe(symbol);
  });
});
