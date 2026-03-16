"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, type Address, parseAbiItem } from "viem";
import { CONTRACTS, TOKEN_MAP } from "@/lib/contracts";
import { XCM_PRECOMPILE } from "@/lib/xcm-encoder";

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

// Simple in-memory cache for Blockscout to avoid 429
let blockscoutCache: { entries: HistoryEntry[]; ts: number; addr: string } | null = null;
const BLOCKSCOUT_TTL = 30_000; // 30s

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
      // Scan last ~200K blocks (~1 month on Polkadot Hub, ~6s/block)
      const fromBlock = currentBlock > 200_000n ? currentBlock - 200_000n : 0n;

      // Fetch IntentExecuted + TokenCreated independently (one failing shouldn't break the other)
      const items: HistoryEntry[] = [];

      try {
        const intentLogs = await publicClient.getLogs({
          address: CONTRACTS.intentExecutor as Address,
          event: INTENT_EXECUTED_EVENT,
          args: { user: address },
          fromBlock,
          toBlock: "latest",
        });
        for (const log of intentLogs) {
          items.push({
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            intentType: (log.args.intentType as string) || "swap",
            tokenIn: resolveSymbol(log.args.tokenIn as string),
            tokenOut: resolveSymbol(log.args.tokenOut as string),
            amountIn: fmtAmount(log.args.amountIn as bigint),
            amountOut: fmtAmount(log.args.amountOut as bigint),
          });
        }
      } catch { /* IntentExecuted fetch failed — continue */ }

      try {
        // Fetch all TokenCreated and filter client-side (some RPCs don't support indexed topic filters)
        const tokenLogs = await publicClient.getLogs({
          address: CONTRACTS.tokenFactory as Address,
          event: TOKEN_CREATED_EVENT,
          fromBlock,
          toBlock: "latest",
        });
        for (const log of tokenLogs) {
          const creator = (log.args.creator as string)?.toLowerCase();
          if (creator !== address.toLowerCase()) continue;
          items.push({
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            intentType: "create_token",
            tokenIn: log.args.symbol as string,
            tokenOut: "",
            amountIn: fmtAmount(log.args.initialSupply as bigint),
            amountOut: "",
          });
        }
      } catch { /* TokenCreated fetch failed — continue */ }

      // Fetch bridge txs via Blockscout API (XCM precompile emits no custom events)
      // Uses in-memory cache to avoid 429 rate limiting
      const now = Date.now();
      if (blockscoutCache && blockscoutCache.addr === address && now - blockscoutCache.ts < BLOCKSCOUT_TTL) {
        items.push(...blockscoutCache.entries);
      } else {
        try {
          const res = await fetch(
            `https://blockscout-testnet.polkadot.io/api?module=account&action=txlist&address=${address}&filter_by=from&sort=desc&page=1&offset=50`
          );
          const json = await res.json();
          const bridgeItems: HistoryEntry[] = [];
          if (json.status === "1" && Array.isArray(json.result)) {
            const xcmAddr = XCM_PRECOMPILE.toLowerCase();
            for (const tx of json.result) {
              if (tx.to?.toLowerCase() !== xcmAddr) continue;
              if (tx.isError === "1" || tx.txreceipt_status === "0") continue;
              const valueBig = BigInt(tx.value || "0");
              bridgeItems.push({
                txHash: tx.hash,
                blockNumber: BigInt(tx.blockNumber),
                intentType: "bridge",
                tokenIn: "PAS",
                tokenOut: "Relay Chain",
                amountIn: valueBig > 0n ? fmtAmount(valueBig) : "",
                amountOut: "",
              });
            }
          }
          blockscoutCache = { entries: bridgeItems, ts: now, addr: address };
          items.push(...bridgeItems);
        } catch { /* Blockscout API may be unavailable */ }
      }

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
