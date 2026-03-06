import { validateParsedIntent, validateUserMessage } from "@/lib/intent-validator";
import type { IntentParseResult } from "@/lib/types";

describe("validateUserMessage", () => {
  it("returns null for valid message", () => {
    expect(validateUserMessage("Swap 10 DOT to USDT")).toBeNull();
  });

  it("rejects empty string", () => {
    const result = validateUserMessage("");
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    const result = validateUserMessage("   ");
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
  });

  it("rejects null", () => {
    const result = validateUserMessage(null);
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
  });

  it("rejects undefined", () => {
    const result = validateUserMessage(undefined);
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
  });

  it("rejects number", () => {
    const result = validateUserMessage(42);
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
  });

  it("rejects message over 500 chars", () => {
    const result = validateUserMessage("a".repeat(501));
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect((result as any).clarification).toContain("500");
  });

  it("accepts message exactly 500 chars", () => {
    expect(validateUserMessage("a".repeat(500))).toBeNull();
  });
});

describe("validateParsedIntent", () => {
  // --- Should pass through ---

  it("passes valid swap intent", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "USDT", amount: 10 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.intent.token_from).toBe("DOT");
      expect(result.intent.token_to).toBe("USDT");
      expect(result.intent.amount).toBe(10);
    }
  });

  it("passes valid DOT → USDC swap", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "USDC", amount: 5 },
    };
    expect(validateParsedIntent(input).success).toBe(true);
  });

  it("passes valid USDT → DOT swap", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "USDT", token_to: "DOT", amount: 100 },
    };
    expect(validateParsedIntent(input).success).toBe(true);
  });

  it("passes valid swap with decimal amount", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "USDT", amount: 0.5 },
    };
    expect(validateParsedIntent(input).success).toBe(true);
  });

  it("passes through AI clarification responses", () => {
    const input: IntentParseResult = {
      success: false,
      clarification: "Could you clarify?",
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.clarification).toBe("Could you clarify?");
    }
  });

  // --- Should reject ---

  it("rejects unsupported action", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "stake" as any, token_from: "DOT", token_to: "USDT", amount: 10 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.clarification).toContain("swap");
    }
  });

  it("rejects hallucinated token_from", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "ETH", token_to: "USDT", amount: 10 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.clarification).toContain("Supported tokens");
    }
  });

  it("rejects hallucinated token_to", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "BTC", amount: 10 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("rejects same token swap", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "DOT", amount: 10 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.clarification).toContain("itself");
    }
  });

  it("rejects zero amount", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "USDT", amount: 0 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.clarification).toContain("positive");
    }
  });

  it("rejects negative amount", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "USDT", amount: -5 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("asks for amount when null", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "USDT", amount: null },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.clarification).toContain("How much");
      expect(result.clarification).toContain("DOT");
    }
  });

  it("rejects string amount (type coercion from LLM)", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "swap", token_from: "DOT", token_to: "USDT", amount: "ten" as any },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });
});

describe("validateParsedIntent — transfer", () => {
  it("passes valid transfer intent", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "transfer", token_from: "USDT", token_to: "", amount: 50, recipient: "0x1234567890abcdef1234567890abcdef12345678" },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(true);
  });

  it("rejects transfer with unsupported token", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "transfer", token_from: "ETH", token_to: "", amount: 50, recipient: "0x1234567890abcdef1234567890abcdef12345678" },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("rejects transfer with missing recipient", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "transfer", token_from: "DOT", token_to: "", amount: 10 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.clarification).toContain("recipient");
    }
  });

  it("rejects transfer with invalid address", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "transfer", token_from: "DOT", token_to: "", amount: 10, recipient: "0xinvalid" },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("rejects transfer with zero amount", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "transfer", token_from: "DOT", token_to: "", amount: 0, recipient: "0x1234567890abcdef1234567890abcdef12345678" },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("asks for amount when null", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "transfer", token_from: "DOT", token_to: "", amount: null, recipient: "0x1234567890abcdef1234567890abcdef12345678" },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.clarification).toContain("How much");
    }
  });
});

describe("validateParsedIntent — create_token", () => {
  it("passes valid create_token intent", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenName: "PEPE", tokenSymbol: "PEPE", initialSupply: 1000000 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(true);
  });

  it("rejects missing token name", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenSymbol: "PEPE", initialSupply: 1000000 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("rejects missing token symbol", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenName: "PEPE", initialSupply: 1000000 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("rejects invalid symbol (too long)", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenName: "PEPE", tokenSymbol: "TOOLONGSYMBOL", initialSupply: 1000000 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("rejects invalid symbol (special chars)", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenName: "PEPE", tokenSymbol: "PE$PE", initialSupply: 1000000 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("rejects zero supply", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenName: "PEPE", tokenSymbol: "PEPE", initialSupply: 0 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("rejects missing supply", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenName: "PEPE", tokenSymbol: "PEPE" },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
  });

  it("rejects token name longer than 50 chars", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenName: "A".repeat(51), tokenSymbol: "PEPE", initialSupply: 1000000 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.clarification).toContain("50");
    }
  });

  it("accepts token name exactly 50 chars", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenName: "A".repeat(50), tokenSymbol: "PEPE", initialSupply: 1000000 },
    };
    expect(validateParsedIntent(input).success).toBe(true);
  });

  it("rejects supply exceeding 1e15", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenName: "PEPE", tokenSymbol: "PEPE", initialSupply: 1e15 + 1 },
    };
    const result = validateParsedIntent(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.clarification).toContain("too large");
    }
  });

  it("accepts supply at 1e15", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "create_token", token_from: "", token_to: "", amount: null, tokenName: "PEPE", tokenSymbol: "PEPE", initialSupply: 1e15 },
    };
    expect(validateParsedIntent(input).success).toBe(true);
  });
});

describe("validateParsedIntent — check_balance", () => {
  it("passes check_balance for specific token", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "check_balance", token_from: "USDC", token_to: "", amount: null },
    };
    expect(validateParsedIntent(input).success).toBe(true);
  });

  it("passes check_balance for all tokens (empty token_from)", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "check_balance", token_from: "", token_to: "", amount: null },
    };
    expect(validateParsedIntent(input).success).toBe(true);
  });

  it("passes check_balance with DOT", () => {
    const input: IntentParseResult = {
      success: true,
      intent: { action: "check_balance", token_from: "DOT", token_to: "", amount: null },
    };
    expect(validateParsedIntent(input).success).toBe(true);
  });
});
