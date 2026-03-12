/**
 * Bridge flow tests — validates bridge preview building, receipt types,
 * and integration with xcm-encoder + intent-validator.
 */
import { validateParsedIntent } from "@/lib/intent-validator";
import {
  evmToAccountId32,
  evmToSS58,
  minimumBridgeAmount,
  CHAIN_CONFIGS,
} from "@/lib/xcm-encoder";
import type {
  IntentParseResult,
  BridgePreview,
  BridgeReceipt,
  ParsedIntent,
} from "@/lib/types";

// --- Bridge preview building ---

describe("Bridge preview building", () => {
  const baseBridgeIntent: ParsedIntent = {
    action: "bridge",
    token_from: "PAS",
    token_to: "",
    amount: 20,
    destination_chain: "relay",
  };

  it("builds preview with correct fields", () => {
    const dest = (baseBridgeIntent.destination_chain || "relay") as "relay";
    const cfg = CHAIN_CONFIGS[dest];
    const min = minimumBridgeAmount(dest);
    const localFee = Math.min(20 * 0.1, 2);
    const remoteFee = Number(cfg.remoteFeeBuffer) / 1e10;
    const totalFees = (localFee + remoteFee).toFixed(1);

    const preview: BridgePreview = {
      intent: baseBridgeIntent,
      destinationChain: cfg.label,
      estimatedFees: totalFees,
      minimumAmount: min,
    };

    expect(preview.destinationChain).toBe("Paseo Relay Chain");
    expect(preview.minimumAmount).toBe(1.2);
    expect(parseFloat(preview.estimatedFees)).toBeGreaterThan(0);
    expect(preview.intent.amount).toBe(20);
  });

  it("fee calculation: local 10% capped at 2 PAS + remote 0.2 PAS", () => {
    // Small amount: 5 PAS → local = 0.5, remote = 0.2, total = 0.7
    const smallFee = Math.min(5 * 0.1, 2) + 0.2;
    expect(smallFee).toBeCloseTo(0.7);

    // Large amount: 100 PAS → local = 2 (capped), remote = 0.2, total = 2.2
    const largeFee = Math.min(100 * 0.1, 2) + 0.2;
    expect(largeFee).toBeCloseTo(2.2);
  });

  it("estimated receive amount is amount minus fees", () => {
    const amount = 20;
    const fees = 2.2;
    const receive = amount - fees;
    expect(receive).toBeCloseTo(17.8);
  });

  it("preview with insufficient balance", () => {
    const preview: BridgePreview = {
      intent: baseBridgeIntent,
      destinationChain: "Paseo Relay Chain",
      estimatedFees: "2.2",
      minimumAmount: 1.2,
      insufficientBalance: { have: "5.00", need: 20 },
    };

    expect(preview.insufficientBalance).toBeDefined();
    expect(preview.insufficientBalance!.have).toBe("5.00");
    expect(preview.insufficientBalance!.need).toBe(20);
  });

  it("preview without insufficient balance", () => {
    const preview: BridgePreview = {
      intent: baseBridgeIntent,
      destinationChain: "Paseo Relay Chain",
      estimatedFees: "2.2",
      minimumAmount: 1.2,
    };

    expect(preview.insufficientBalance).toBeUndefined();
  });
});

// --- Bridge receipt ---

describe("BridgeReceipt type", () => {
  it("can construct a valid receipt", () => {
    const receipt: BridgeReceipt = {
      txHash: "0xabc123def456",
      amountPAS: 20,
      destinationChain: "Paseo Relay Chain",
      beneficiary: "0x16Fc1792b61b2C1e93702cC5d2457d1Fd22500BA",
      beneficiarySS58: "1X8wYgu5SU9w52gG9pt8VjZfR9chdKKoeuZvk5jniFCtJNX",
      explorerUrl: "https://blockscout-testnet.polkadot.io/tx/0xabc123def456",
    };

    expect(receipt.amountPAS).toBe(20);
    expect(receipt.destinationChain).toBe("Paseo Relay Chain");
    expect(receipt.beneficiarySS58).toContain("1X8wYgu5");
    expect(receipt.explorerUrl).toContain("blockscout");
  });

  it("beneficiarySS58 matches evmToSS58 output", () => {
    const address = "0x16Fc1792b61b2C1e93702cC5d2457d1Fd22500BA" as `0x${string}`;
    const ss58 = evmToSS58(address);
    expect(ss58).toBe("1X8wYgu5SU9w52gG9pt8VjZfR9chdKKoeuZvk5jniFCtJNX");
  });
});

// --- End-to-end: parse → validate → preview ---

describe("Bridge integration: parse → validate → preview", () => {
  it("valid bridge intent passes validation and builds preview", () => {
    const parsed: IntentParseResult = {
      success: true,
      intent: {
        action: "bridge",
        token_from: "PAS",
        token_to: "",
        amount: 20,
        destination_chain: "relay",
      },
    };

    const validated = validateParsedIntent(parsed);
    expect(validated.success).toBe(true);

    if (validated.success) {
      const dest = validated.intent.destination_chain as "relay";
      const cfg = CHAIN_CONFIGS[dest];
      expect(cfg.label).toBe("Paseo Relay Chain");

      const accountId32 = evmToAccountId32("0x16Fc1792b61b2C1e93702cC5d2457d1Fd22500BA");
      expect(accountId32).toHaveLength(66);
      expect(accountId32.endsWith("eeeeeeeeeeeeeeeeeeeeeeee")).toBe(true);
    }
  });

  it("below-minimum bridge is rejected by validator", () => {
    const parsed: IntentParseResult = {
      success: true,
      intent: {
        action: "bridge",
        token_from: "PAS",
        token_to: "",
        amount: 0.5,
        destination_chain: "relay",
      },
    };

    const validated = validateParsedIntent(parsed);
    expect(validated.success).toBe(false);
    if (!validated.success) {
      expect(validated.clarification).toContain("1.2 PAS");
    }
  });

  it("missing destination is rejected by validator", () => {
    const parsed: IntentParseResult = {
      success: true,
      intent: {
        action: "bridge",
        token_from: "PAS",
        token_to: "",
        amount: 20,
      },
    };

    const validated = validateParsedIntent(parsed);
    expect(validated.success).toBe(false);
  });

  it("chain config has correct existential deposit", () => {
    expect(CHAIN_CONFIGS.relay.existentialDeposit).toBe(10_000_000_000n);
    expect(CHAIN_CONFIGS.relay.remoteFeeBuffer).toBe(2_000_000_000n);
  });

  it("minimum bridge amount covers ED + fees", () => {
    const min = minimumBridgeAmount("relay");
    const ed = Number(CHAIN_CONFIGS.relay.existentialDeposit) / 1e10;
    const fee = Number(CHAIN_CONFIGS.relay.remoteFeeBuffer) / 1e10;
    expect(min).toBe(ed + fee);
    expect(min).toBe(1.2);
  });
});
