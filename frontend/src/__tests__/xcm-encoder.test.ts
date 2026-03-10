import {
  evmToAccountId32,
  minimumBridgeAmount,
  CHAIN_CONFIGS,
  XCM_PRECOMPILE,
  xcmPrecompileAbi,
} from "../lib/xcm-encoder";

// --- evmToAccountId32 ---

describe("evmToAccountId32", () => {
  it("pads H160 with 12 bytes of 0xEE", () => {
    const result = evmToAccountId32("0x16Fc1792b61b2C1e93702cC5d2457d1Fd22500BA");
    expect(result).toBe(
      "0x16fc1792b61b2c1e93702cc5d2457d1fd22500baeeeeeeeeeeeeeeeeeeeeeeee",
    );
  });

  it("lowercases the address", () => {
    const result = evmToAccountId32("0xABCDEF0123456789ABCDEF0123456789ABCDEF01");
    expect(result.startsWith("0xabcdef")).toBe(true);
    expect(result).toHaveLength(66); // 0x + 64 hex chars
  });

  it("result is 32 bytes (64 hex chars + 0x)", () => {
    const result = evmToAccountId32("0x0000000000000000000000000000000000000001");
    expect(result).toHaveLength(66);
    expect(result.endsWith("eeeeeeeeeeeeeeeeeeeeeeee")).toBe(true);
  });

  it("throws for invalid address (too short)", () => {
    expect(() => evmToAccountId32("0x1234" as `0x${string}`)).toThrow(
      "Invalid H160 address",
    );
  });

  it("throws for invalid address (too long)", () => {
    expect(() =>
      evmToAccountId32(
        "0x16Fc1792b61b2C1e93702cC5d2457d1Fd22500BA00" as `0x${string}`,
      ),
    ).toThrow("Invalid H160 address");
  });

  it("handles zero address", () => {
    const result = evmToAccountId32("0x0000000000000000000000000000000000000000");
    expect(result).toBe(
      "0x0000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeee",
    );
  });
});

// --- minimumBridgeAmount ---

describe("minimumBridgeAmount", () => {
  it("returns correct minimum for relay chain", () => {
    const min = minimumBridgeAmount("relay");
    // ED (1 PAS) + fee buffer (0.2 PAS) = 1.2 PAS
    expect(min).toBe(1.2);
  });

  it("is greater than existential deposit alone", () => {
    const min = minimumBridgeAmount("relay");
    const ed = Number(CHAIN_CONFIGS.relay.existentialDeposit) / 1e10;
    expect(min).toBeGreaterThan(ed);
  });
});

// --- Constants ---

describe("XCM constants", () => {
  it("precompile address is correct", () => {
    expect(XCM_PRECOMPILE).toBe(
      "0x00000000000000000000000000000000000a0000",
    );
  });

  it("ABI has execute, weighMessage, send", () => {
    const names = xcmPrecompileAbi.map((f) => f.name);
    expect(names).toContain("execute");
    expect(names).toContain("weighMessage");
    expect(names).toContain("send");
  });

  it("relay chain config has correct ED", () => {
    expect(CHAIN_CONFIGS.relay.existentialDeposit).toBe(10_000_000_000n);
  });
});

// --- encodeTeleport / encodeLocalTransfer (require @polkadot/api connection) ---
// These are integration tests — they need a real WS connection.
// We test the encoding logic via the pure helper functions above.
// Full encoding tests are in xcm-encoder.integration.test.ts (skipped in CI).

describe("encodeTeleport validation", () => {
  // We can test that the function exists and the module exports are correct
  it("module exports encodeTeleport and encodeLocalTransfer", () => {
    const mod = require("../lib/xcm-encoder");
    expect(typeof mod.encodeTeleport).toBe("function");
    expect(typeof mod.encodeLocalTransfer).toBe("function");
  });

  it("module exports getAssetHubApi", () => {
    const mod = require("../lib/xcm-encoder");
    expect(typeof mod.getAssetHubApi).toBe("function");
  });
});
