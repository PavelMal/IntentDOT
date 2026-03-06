import { NextRequest, NextResponse } from "next/server";
import type { IntentParseResult } from "@/lib/types";
import { validateParsedIntent, validateUserMessage } from "@/lib/intent-validator";

const SYSTEM_PROMPT = `You are IntentDOT — an AI that parses DeFi intents on Polkadot.

Your ONLY job: extract structured parameters from user messages.

Supported tokens: DOT, USDT, USDC
Supported actions: swap, transfer, create_token, check_balance

Rules:
- SWAP: If the user wants to swap/exchange/trade/buy/sell/convert tokens, extract swap parameters.
  - "Buy USDT with DOT" means swap FROM DOT TO USDT.
  - "Sell DOT for USDT" means swap FROM DOT TO USDT.
- TRANSFER: If the user wants to send/transfer tokens to an address, extract transfer parameters.
  - "Send 50 USDT to 0xABC..." means transfer FROM USDT, recipient 0xABC...
  - "Transfer 10 DOT to 0x..." means transfer FROM DOT, recipient 0x...
- CREATE TOKEN: If the user wants to create/launch/mint a new token, extract create_token parameters.
  - "Create a token called PEPE with 1M supply" means create_token with tokenName "PEPE", tokenSymbol "PEPE", initialSupply 1000000.
  - "Launch my token MOON, 500K coins" means create_token with tokenName "MOON", tokenSymbol "MOON", initialSupply 500000.
- CHECK BALANCE: If the user asks about their balance, holdings, how many tokens they have, or portfolio.
  - "How many USDC do I have?" means check_balance, token_from "USDC".
  - "What's my balance?" or "Show my tokens" or "What do I have?" means check_balance, token_from "" (all tokens).
  - "Check my DOT balance" means check_balance, token_from "DOT".
  - For check_balance, ANY token symbol is valid (including user-created tokens like PEPE, MOON, etc). Pass through the exact symbol the user mentions.
- If amount is missing, set amount to null.
- If the intent is unclear, respond with clarification.
- Never invent tokens not in the supported list (for swap/transfer).
- For create_token, any name/symbol is allowed.

Respond with EXACTLY one of these JSON formats, nothing else:

Swap:
{"success": true, "intent": {"action": "swap", "token_from": "DOT", "token_to": "USDT", "amount": 10}}

Transfer:
{"success": true, "intent": {"action": "transfer", "token_from": "USDT", "token_to": "", "amount": 50, "recipient": "0x1234567890abcdef1234567890abcdef12345678"}}

Create Token:
{"success": true, "intent": {"action": "create_token", "token_from": "", "token_to": "", "amount": null, "tokenName": "PEPE", "tokenSymbol": "PEPE", "initialSupply": 1000000}}

Check Balance (specific token):
{"success": true, "intent": {"action": "check_balance", "token_from": "USDC", "token_to": "", "amount": null}}

Check Balance (all tokens):
{"success": true, "intent": {"action": "check_balance", "token_from": "", "token_to": "", "amount": null}}

Need clarification:
{"success": false, "clarification": "Could you clarify? For example: 'Swap 10 DOT to USDT'"}`;

function fail(message: string): NextResponse {
  return NextResponse.json(
    { success: false, clarification: message } satisfies IntentParseResult,
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const apiKey = anthropicKey || openaiKey;
  const provider = anthropicKey ? "anthropic" : "openai";

  if (!apiKey) {
    return fail("AI service not configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
  }

  const { message } = await req.json();

  const messageError = validateUserMessage(message);
  if (messageError) {
    return NextResponse.json(messageError, { status: 200 });
  }

  try {
    let content: string | null = null;

    if (provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "claude-sonnet-4-6",
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: message }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        // Anthropic API error — logged server-side only in dev
        if (process.env.NODE_ENV === "development") console.error("Anthropic API error:", error);
        return fail("AI service temporarily unavailable. Please try again.");
      }

      const data = await response.json();
      content = data.content?.[0]?.text ?? null;
    } else {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "gpt-4o-mini",
          temperature: 0,
          max_tokens: 200,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: message },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        if (process.env.NODE_ENV === "development") console.error("OpenAI API error:", error);
        return fail("AI service temporarily unavailable. Please try again.");
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content ?? null;
    }

    if (!content) {
      return fail("Failed to parse your intent. Try: 'Swap 10 DOT to USDT'");
    }

    // Extract JSON from response (Claude may wrap it in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fail("Failed to parse your intent. Try: 'Swap 10 DOT to USDT'");
    }

    const parsed = JSON.parse(jsonMatch[0]) as IntentParseResult;
    const validated = validateParsedIntent(parsed);

    return NextResponse.json(validated, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("Parse intent error:", error);
    return fail("Something went wrong. Please try again.");
  }
}
