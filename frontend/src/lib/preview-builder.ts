import type { TransactionPreview, TransferPreview, TokenCreatePreview, ParsedIntent } from "./types";
import { assessRisk, getAmountOut, formatTokenAmount } from "./risk-guardian";
import type { PoolState } from "./risk-guardian";
import { TOKEN_MAP, CONTRACTS } from "./contracts";
import { createPublicClient, http, type Address } from "viem";
import { mockDexAbi } from "./abis";

const ETH = 10n ** 18n;

/**
 * Hardcoded pool reserves matching SeedPools.s.sol.
 * Used as fallback when on-chain reads are unavailable (dev mode, no contracts deployed).
 */
const SEEDED_POOLS: Record<string, PoolState> = {
  "DOT-USDT": { reserveIn: 50_000n * ETH, reserveOut: 337_500n * ETH },
  "USDT-DOT": { reserveIn: 337_500n * ETH, reserveOut: 50_000n * ETH },
  "DOT-USDC": { reserveIn: 50_000n * ETH, reserveOut: 337_500n * ETH },
  "USDC-DOT": { reserveIn: 337_500n * ETH, reserveOut: 50_000n * ETH },
};

/**
 * Get fallback pool reserves for a token pair.
 * Returns null if no pool exists.
 */
export function getPoolReserves(tokenFrom: string, tokenTo: string): PoolState | null {
  return SEEDED_POOLS[`${tokenFrom}-${tokenTo}`] ?? null;
}

/**
 * Fetch live pool reserves from MockDEX on-chain.
 * Returns null if contracts aren't configured or read fails.
 */
export async function fetchPoolReserves(tokenFrom: string, tokenTo: string): Promise<PoolState | null> {
  const tokenIn = TOKEN_MAP[tokenFrom];
  const tokenOut = TOKEN_MAP[tokenTo];
  const dexAddress = CONTRACTS.mockDex;

  if (!tokenIn || !tokenOut || dexAddress === "0x0000000000000000000000000000000000000000") {
    return null;
  }

  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://eth-rpc-testnet.polkadot.io/";
    const client = createPublicClient({ transport: http(rpcUrl) });

    const data = await client.readContract({
      address: dexAddress as Address,
      abi: mockDexAbi,
      functionName: "getPool",
      args: [tokenIn.address, tokenOut.address],
    });

    const [token0, , reserve0, reserve1] = data as [Address, Address, bigint, bigint];

    if (reserve0 === 0n && reserve1 === 0n) return null;

    const isToken0In = tokenIn.address.toLowerCase() === token0.toLowerCase();
    return isToken0In
      ? { reserveIn: reserve0, reserveOut: reserve1 }
      : { reserveIn: reserve1, reserveOut: reserve0 };
  } catch {
    return null;
  }
}

/**
 * Build a TransactionPreview from a parsed intent using Risk Guardian.
 * Accepts optional on-chain pool state; falls back to seeded stubs.
 * Returns null if amount is missing/invalid or no pool exists.
 */
export function buildPreview(
  intent: Pick<ParsedIntent, "token_from" | "token_to" | "amount">,
  onChainPool?: PoolState | null
): TransactionPreview | null {
  if (!intent.amount || intent.amount <= 0) return null;

  const pool = onChainPool ?? getPoolReserves(intent.token_from, intent.token_to);
  if (!pool) return null;

  const amountInWei = BigInt(Math.round(intent.amount * 1e18));
  const amountOutWei = getAmountOut(amountInWei, pool.reserveIn, pool.reserveOut);
  const risk = assessRisk(amountInWei, pool);
  const amountOut = formatTokenAmount(amountOutWei);

  const tokenIn = TOKEN_MAP[intent.token_from];
  const tokenOut = TOKEN_MAP[intent.token_to];

  return {
    intent: { action: "swap", token_from: intent.token_from, token_to: intent.token_to, amount: intent.amount },
    amountOut,
    risk,
    tokenInAddress: tokenIn?.address ?? "0x0",
    tokenOutAddress: tokenOut?.address ?? "0x0",
  };
}

/**
 * Build a TransferPreview from a parsed transfer intent.
 */
export function buildTransferPreview(
  intent: Pick<ParsedIntent, "action" | "token_from" | "token_to" | "amount" | "recipient">
): TransferPreview | null {
  if (!intent.amount || intent.amount <= 0) return null;
  if (!intent.recipient) return null;

  const isNative = intent.token_from === "PAS";
  const token = isNative ? null : TOKEN_MAP[intent.token_from];
  if (!isNative && !token) return null;

  return {
    intent: { action: "transfer", token_from: intent.token_from, token_to: "", amount: intent.amount, recipient: intent.recipient },
    tokenAddress: isNative ? "0x0000000000000000000000000000000000000000" : token!.address,
  };
}

/**
 * Build a TokenCreatePreview from a parsed create_token intent.
 */
export function buildTokenCreatePreview(
  intent: Pick<ParsedIntent, "action" | "token_from" | "token_to" | "amount" | "tokenName" | "tokenSymbol" | "initialSupply">
): TokenCreatePreview | null {
  if (!intent.tokenName || !intent.tokenSymbol || !intent.initialSupply) return null;

  return {
    intent: {
      action: "create_token",
      token_from: "",
      token_to: "",
      amount: null,
      tokenName: intent.tokenName,
      tokenSymbol: intent.tokenSymbol,
      initialSupply: intent.initialSupply,
    },
  };
}
