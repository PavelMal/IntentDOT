"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePublicClient, useReadContracts } from "wagmi";
import { formatUnits, parseAbiItem, type Address } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { mockDexAbi } from "@/lib/abis";
import { Sparkline, PriceChartModal } from "./Sparkline";

const POOLS = [
  { name: "DOT / USDT", tokenA: CONTRACTS.dotToken, tokenB: CONTRACTS.usdtToken, quote: "USDT" },
  { name: "DOT / USDC", tokenA: CONTRACTS.dotToken, tokenB: CONTRACTS.usdcToken, quote: "USDC" },
] as const;

const SWAPPED_EVENT = parseAbiItem(
  "event Swapped(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)"
);

function fmtReserve(value: bigint | undefined): string {
  if (value === undefined) return "—";
  const num = parseFloat(formatUnits(value, 18));
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

function poolPrice(reserveA: bigint | undefined, reserveB: bigint | undefined): string {
  if (!reserveA || !reserveB || reserveA === 0n) return "—";
  return (Number(reserveB) / Number(reserveA)).toFixed(2);
}

export function PoolInfo() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const publicClient = usePublicClient();
  const [priceHistory, setPriceHistory] = useState<Record<string, number[]>>({});
  const [chartModal, setChartModal] = useState<{ poolName: string; quote: string; prices: number[]; currentPrice: string } | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data } = useReadContracts({
    contracts: POOLS.map((p) => ({
      address: CONTRACTS.mockDex,
      abi: mockDexAbi,
      functionName: "getPool",
      args: [p.tokenA, p.tokenB],
    })),
    query: { refetchInterval: 12_000 },
  });

  // Fetch swap events for price history when dropdown opens
  const fetchPriceHistory = useCallback(async () => {
    if (!publicClient) return;
    try {
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 200_000n ? currentBlock - 200_000n : 0n;

      const logs = await publicClient.getLogs({
        address: CONTRACTS.mockDex as Address,
        event: SWAPPED_EVENT,
        fromBlock,
        toBlock: "latest",
      });

      const history: Record<string, number[]> = {};

      for (const log of logs) {
        const tokenIn = (log.args.tokenIn as string).toLowerCase();
        const tokenOut = (log.args.tokenOut as string).toLowerCase();
        const amountIn = log.args.amountIn as bigint;
        const amountOut = log.args.amountOut as bigint;
        if (amountIn === 0n) continue;

        // Find which pool this belongs to
        for (const pool of POOLS) {
          const a = pool.tokenA.toLowerCase();
          const b = pool.tokenB.toLowerCase();

          if ((tokenIn === a && tokenOut === b) || (tokenIn === b && tokenOut === a)) {
            const key = pool.name;
            if (!history[key]) history[key] = [];

            // Normalize: price = quote / base (e.g. USDT per DOT)
            let price: number;
            if (tokenIn === a) {
              // DOT → USDT: price = amountOut / amountIn
              price = Number(formatUnits(amountOut, 18)) / Number(formatUnits(amountIn, 18));
            } else {
              // USDT → DOT: price = amountIn / amountOut
              price = Number(formatUnits(amountIn, 18)) / Number(formatUnits(amountOut, 18));
            }
            history[key].push(price);
            break;
          }
        }
      }

      setPriceHistory(history);
    } catch { /* silently fail */ }
  }, [publicClient]);

  // Fetch on open
  useEffect(() => {
    if (open) fetchPriceHistory();
  }, [open, fetchPriceHistory]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs hover:border-white/[0.15] hover:bg-white/[0.05] transition-all"
      >
        <svg className="h-3.5 w-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
        <span className="text-white/50">Pools</span>
        <svg
          className={`h-3 w-3 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/[0.08] bg-[#1a1425] backdrop-blur-xl shadow-2xl z-50 animate-fade-in-up overflow-hidden">
          <div className="px-4 pt-3 pb-3">
            <div className="space-y-4">
              {POOLS.map((pool, i) => {
                const result = data?.[i]?.result as [string, string, bigint, bigint] | undefined;
                const token0 = result?.[0]?.toLowerCase();
                const r0 = result?.[2];
                const r1 = result?.[3];
                // getPool sorts by address — figure out which reserve is DOT vs quote
                const isDotToken0 = token0 === pool.tokenA.toLowerCase();
                const dotReserve = isDotToken0 ? r0 : r1;
                const quoteReserve = isDotToken0 ? r1 : r0;
                const p = poolPrice(dotReserve, quoteReserve);
                const prices = priceHistory[pool.name] || [];

                return (
                  <div key={pool.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white/60">{pool.name}</span>
                      <span className="text-[10px] text-white/25">
                        {fmtReserve(dotReserve)} DOT / {fmtReserve(quoteReserve)} {pool.quote}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">
                        1 DOT <span className="text-polkadot-pink font-mono">≈ {p} {pool.quote}</span>
                      </span>
                      {prices.length >= 2 && (
                        <Sparkline
                          data={prices}
                          width={80}
                          height={20}
                          onClick={() => setChartModal({ poolName: pool.name, quote: pool.quote, prices, currentPrice: p })}
                        />
                      )}
                      {prices.length < 2 && prices.length > 0 && (
                        <span className="text-[10px] text-white/20">1 trade</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {chartModal && (
        <PriceChartModal
          poolName={chartModal.poolName}
          quote={chartModal.quote}
          prices={chartModal.prices}
          currentPrice={chartModal.currentPrice}
          onClose={() => setChartModal(null)}
        />
      )}
    </div>
  );
}
