"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS, TOKEN_MAP } from "@/lib/contracts";
import { mockDexAbi } from "@/lib/abis";
import type { PoolState } from "@/lib/risk-guardian";
import type { Address } from "viem";

/**
 * Read pool reserves from MockDEX on-chain.
 * Falls back to null if contract is not deployed or tokens are unknown.
 */
export function usePoolReserves(
  tokenFromSymbol: string,
  tokenToSymbol: string
): { pool: PoolState | null; isLoading: boolean; isOnChain: boolean } {
  const tokenIn = TOKEN_MAP[tokenFromSymbol];
  const tokenOut = TOKEN_MAP[tokenToSymbol];
  const dexAddress = CONTRACTS.mockDex;
  const isConfigured =
    !!tokenIn &&
    !!tokenOut &&
    dexAddress !== "0x0000000000000000000000000000000000000000";

  const { data, isLoading, isError } = useReadContract({
    address: dexAddress as Address,
    abi: mockDexAbi,
    functionName: "getPool",
    args: tokenIn && tokenOut ? [tokenIn.address, tokenOut.address] : undefined,
    query: { enabled: isConfigured },
  });

  if (!isConfigured || isLoading || isError || !data) {
    return { pool: null, isLoading, isOnChain: false };
  }

  const [token0, , reserve0, reserve1] = data as [Address, Address, bigint, bigint];

  if (reserve0 === 0n && reserve1 === 0n) {
    return { pool: null, isLoading: false, isOnChain: true };
  }

  // Sort reserves so reserveIn matches the input token
  const isToken0In = tokenIn && tokenIn.address.toLowerCase() === token0.toLowerCase();
  const pool: PoolState = isToken0In
    ? { reserveIn: reserve0, reserveOut: reserve1 }
    : { reserveIn: reserve1, reserveOut: reserve0 };

  return { pool, isLoading: false, isOnChain: true };
}
