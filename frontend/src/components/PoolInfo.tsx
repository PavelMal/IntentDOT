"use client";

import { useState, useRef, useEffect } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { mockDexAbi } from "@/lib/abis";

const POOLS = [
  { name: "DOT / USDT", tokenA: CONTRACTS.dotToken, tokenB: CONTRACTS.usdtToken },
  { name: "DOT / USDC", tokenA: CONTRACTS.dotToken, tokenB: CONTRACTS.usdcToken },
] as const;

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

  const pool0 = data?.[0]?.result as [string, string, bigint, bigint] | undefined;
  const topPrice = poolPrice(pool0?.[2], pool0?.[3]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs hover:border-white/[0.15] hover:bg-white/[0.05] transition-all"
      >
        <svg className="h-3.5 w-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
        <span className="text-white/40">DOT</span>
        <span className="text-polkadot-pink font-mono">{topPrice}</span>
        <svg
          className={`h-3 w-3 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-white/[0.08] bg-[#1a1425] backdrop-blur-xl shadow-2xl z-50 animate-fade-in-up overflow-hidden">
          <div className="px-4 pt-3 pb-3">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2.5">Pools</div>
            <div className="space-y-2.5">
              {POOLS.map((pool, i) => {
                const result = data?.[i]?.result as [string, string, bigint, bigint] | undefined;
                const r0 = result?.[2];
                const r1 = result?.[3];
                return (
                  <div key={pool.name} className="flex items-center justify-between">
                    <span className="text-xs text-white/50">{pool.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-polkadot-pink font-mono">{poolPrice(r0, r1)}</span>
                      <span className="text-[10px] text-white/25">{fmtReserve(r0)} / {fmtReserve(r1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
