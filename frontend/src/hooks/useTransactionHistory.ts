"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, type Address, parseAbiItem } from "viem";
import { CONTRACTS, TOKEN_MAP } from "@/lib/contracts";

export interface HistoryEntry {
  txHash: string;
  blockNumber: bigint;
  intentType: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
}

const INTENT_EXECUTED_EVENT = parseAbiItem(
  "event IntentExecuted(address indexed user, string intentType, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)"
);

const TOKEN_CREATED_EVENT = parseAbiItem(
  "event TokenCreated(address indexed creator, address indexed tokenAddress, string name, string symbol, uint256 initialSupply)"
);

// Reverse lookup: address → symbol
const ADDR_TO_SYMBOL: Record<string, string> = {};
for (const [symbol, info] of Object.entries(TOKEN_MAP)) {
  ADDR_TO_SYMBOL[info.address.toLowerCase()] = symbol;
}

function resolveSymbol(addr: string): string {
  return ADDR_TO_SYMBOL[addr.toLowerCase()] || `${addr.slice(0, 6)}...`;
}

function fmtAmount(value: bigint): string {
  const num = parseFloat(formatUnits(value, 18));
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  if (num < 0.01 && num > 0) return "<0.01";
  return num.toFixed(2);
}

export function useTransactionHistory() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address || !publicClient) return;

    setLoading(true);
    try {
      const currentBlock = await publicClient.getBlockNumber();
      // Scan last ~50K blocks (~7 days on Polkadot Hub)
      const fromBlock = currentBlock > 50_000n ? currentBlock - 50_000n : 0n;

      // Fetch IntentExecuted + TokenCreated in parallel
      const [intentLogs, tokenLogs] = await Promise.all([
        publicClient.getLogs({
          address: CONTRACTS.intentExecutor as Address,
          event: INTENT_EXECUTED_EVENT,
          args: { user: address },
          fromBlock,
          toBlock: "latest",
        }),
        publicClient.getLogs({
          address: CONTRACTS.tokenFactory as Address,
          event: TOKEN_CREATED_EVENT,
          args: { creator: address },
          fromBlock,
          toBlock: "latest",
        }),
      ]);

      const items: HistoryEntry[] = [
        ...intentLogs.map((log) => ({
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          intentType: (log.args.intentType as string) || "swap",
          tokenIn: resolveSymbol(log.args.tokenIn as string),
          tokenOut: resolveSymbol(log.args.tokenOut as string),
          amountIn: fmtAmount(log.args.amountIn as bigint),
          amountOut: fmtAmount(log.args.amountOut as bigint),
        })),
        ...tokenLogs.map((log) => ({
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          intentType: "create_token",
          tokenIn: log.args.symbol as string,
          tokenOut: "",
          amountIn: fmtAmount(log.args.initialSupply as bigint),
          amountOut: "",
        })),
      ];

      // Sort by block number descending (most recent first)
      items.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0));
      setEntries(items);
    } catch {
      // RPC may not support large range — silently fail
    } finally {
      setLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, loading, refresh };
}
