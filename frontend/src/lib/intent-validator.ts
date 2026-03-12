import type { IntentParseResult } from "./types";

const VALID_TOKENS = ["DOT", "USDT", "USDC", "PAS"];
const VALID_BRIDGE_DESTINATIONS = ["relay"];
const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

/**
 * Validates raw AI parser output and returns a sanitized IntentParseResult.
 * Catches hallucinated tokens, invalid amounts, same-token swaps, missing amounts.
 */
export function validateParsedIntent(raw: IntentParseResult): IntentParseResult {
  // If AI returned clarification, pass through
  if (!raw.success) return raw;

  const { action, token_from, token_to, amount } = raw.intent;

  if (action === "swap") {
    return validateSwap(raw);
  }

  if (action === "transfer") {
    return validateTransfer(raw);
  }

  if (action === "create_token") {
    return validateCreateToken(raw);
  }

  if (action === "bridge") {
    return validateBridge(raw);
  }

  if (action === "check_balance") {
    return raw; // No validation needed — token_from can be empty (all tokens) or a specific token
  }

  return {
    success: false,
    clarification: "Supported actions: swap, transfer, bridge, create token, check balance. Try: 'Swap 10 DOT to USDT' or 'Bridge 20 PAS to relay chain'",
  };
}

function validateSwap(raw: IntentParseResult): IntentParseResult {
  if (!raw.success) return raw;
  const { token_from, token_to, amount } = raw.intent;

  if (!VALID_TOKENS.includes(token_from) || !VALID_TOKENS.includes(token_to)) {
    return {
      success: false,
      clarification: `Supported tokens: ${VALID_TOKENS.join(", ")}. Try: 'Swap 10 DOT to USDT'`,
    };
  }

  if (token_from === "PAS" || token_to === "PAS") {
    return {
      success: false,
      clarification: "PAS is the native token and cannot be swapped on DEX. You can transfer PAS or bridge it. Try: 'Send 5 PAS to 0x...' or 'Bridge 20 PAS to relay chain'",
    };
  }

  if (token_from === token_to) {
    return {
      success: false,
      clarification: "Cannot swap a token for itself. Choose two different tokens.",
    };
  }

  if (amount !== null && (typeof amount !== "number" || amount <= 0)) {
    return {
      success: false,
      clarification: "Amount must be a positive number. Try: 'Swap 10 DOT to USDT'",
    };
  }

  if (amount === null) {
    return {
      success: false,
      clarification: `How much ${token_from} do you want to swap to ${token_to}? Example: 'Swap 10 ${token_from} to ${token_to}'`,
    };
  }

  return raw;
}

function validateTransfer(raw: IntentParseResult): IntentParseResult {
  if (!raw.success) return raw;
  const { token_from, amount, recipient } = raw.intent;

  if (!VALID_TOKENS.includes(token_from)) {
    return {
      success: false,
      clarification: `Supported tokens: ${VALID_TOKENS.join(", ")}. Try: 'Send 50 USDT to 0x...'`,
    };
  }

  if (!recipient || !ETH_ADDRESS_REGEX.test(recipient)) {
    return {
      success: false,
      clarification: "Please provide a valid recipient address (0x followed by 40 hex characters). Try: 'Send 50 USDT to 0x1234...'",
    };
  }

  if (amount !== null && (typeof amount !== "number" || amount <= 0)) {
    return {
      success: false,
      clarification: "Amount must be a positive number. Try: 'Send 50 USDT to 0x...'",
    };
  }

  if (amount === null) {
    return {
      success: false,
      clarification: `How much ${token_from} do you want to send? Example: 'Send 50 ${token_from} to ${recipient}'`,
    };
  }

  return raw;
}

function validateCreateToken(raw: IntentParseResult): IntentParseResult {
  if (!raw.success) return raw;
  const { tokenName, tokenSymbol, initialSupply } = raw.intent;

  if (!tokenName || typeof tokenName !== "string" || tokenName.trim().length === 0) {
    return {
      success: false,
      clarification: "Please provide a token name. Try: 'Create a token called PEPE with 1M supply'",
    };
  }

  if (tokenName.length > 50) {
    return {
      success: false,
      clarification: "Token name is too long (max 50 characters).",
    };
  }

  if (!tokenSymbol || typeof tokenSymbol !== "string" || !/^[A-Za-z0-9]{1,10}$/.test(tokenSymbol)) {
    return {
      success: false,
      clarification: "Token symbol must be 1-10 alphanumeric characters. Try: 'Create a token called MyToken with symbol MTK and 1M supply'",
    };
  }

  if (!initialSupply || typeof initialSupply !== "number" || initialSupply <= 0) {
    return {
      success: false,
      clarification: "Please specify a positive initial supply. Try: 'Create a token called PEPE with 1000000 supply'",
    };
  }

  if (initialSupply > 1e15) {
    return {
      success: false,
      clarification: "Initial supply is too large (max 1,000,000,000,000,000). Try a smaller number.",
    };
  }

  return raw;
}

function validateBridge(raw: IntentParseResult): IntentParseResult {
  if (!raw.success) return raw;
  const { amount, destination_chain } = raw.intent;

  if (!destination_chain || !VALID_BRIDGE_DESTINATIONS.includes(destination_chain)) {
    return {
      success: false,
      clarification: `Supported bridge destinations: ${VALID_BRIDGE_DESTINATIONS.join(", ")}. Try: 'Bridge 20 PAS to relay chain'`,
    };
  }

  if (amount !== null && (typeof amount !== "number" || amount <= 0)) {
    return {
      success: false,
      clarification: "Amount must be a positive number. Try: 'Bridge 20 PAS to relay chain'",
    };
  }

  if (amount === null) {
    return {
      success: false,
      clarification: "How much PAS do you want to bridge? Example: 'Bridge 20 PAS to relay chain'",
    };
  }

  // Minimum: 1.2 PAS (ED 1 PAS + 0.2 fee buffer)
  if (amount < 1.2) {
    return {
      success: false,
      clarification: "Minimum bridge amount is 1.2 PAS (1 PAS existential deposit + 0.2 PAS fees). Try a larger amount.",
    };
  }

  return raw;
}

/**
 * Validates raw user message before sending to AI.
 * Returns null if valid, or an error IntentParseResult if invalid.
 */
export function validateUserMessage(message: unknown): IntentParseResult | null {
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return {
      success: false,
      clarification: "Please enter a valid message.",
    };
  }

  if (message.length > 500) {
    return {
      success: false,
      clarification: "Message too long (max 500 characters).",
    };
  }

  return null;
}
