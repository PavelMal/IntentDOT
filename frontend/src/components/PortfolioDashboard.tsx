"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { mockERC20Abi, mockDexAbi } from "@/lib/abis";

const TOKENS = [
  { symbol: "DOT", address: CONTRACTS.dotToken, decimals: 18, primary: true },
  { symbol: "USDT", address: CONTRACTS.usdtToken, decimals: 18, primary: true },
  { symbol: "USDC", address: CONTRACTS.usdcToken, decimals: 18, primary: false },
] as const;

const POOLS = [
  { name: "DOT/USDT", tokenA: CONTRACTS.dotToken, tokenB: CONTRACTS.usdtToken },
  { name: "DOT/USDC", tokenA: CONTRACTS.dotToken, tokenB: CONTRACTS.usdcToken },
] as const;

function fmtBal(value: bigint | undefined, decimals: number): string {
  if (value === undefined) return "—";
  const num = parseFloat(formatUnits(value, decimals));
  if (num === 0) return "0";
  if (num < 0.01) return "<0.01";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(2);
}

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

export function PortfolioDashboard() {
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: nativeBalance } = useBalance({
    address,
    query: { refetchInterval: 12_000 },
  });

  const { data: tokenBalances } = useReadContracts({
    contracts: TOKENS.map((t) => ({
      address: t.address,
      abi: mockERC20Abi,
      functionName: "balanceOf",
      args: [address!],
    })),
    query: { enabled: !!address, refetchInterval: 12_000 },
  });

  const { data: poolData } = useReadContracts({
    contracts: POOLS.map((p) => ({
      address: CONTRACTS.mockDex,
      abi: mockDexAbi,
      functionName: "getPool",
      args: [p.tokenA, p.tokenB],
    })),
    query: { refetchInterval: 12_000 },
  });

  if (!address) return null;

  // Summary for the button: DOT balance + top pool price
  const dotBal = fmtBal(tokenBalances?.[0]?.result as bigint | undefined, 18);
  const pool0 = poolData?.[0]?.result as [string, string, bigint, bigint] | undefined;
  const topPrice = poolPrice(pool0?.[2], pool0?.[3]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs hover:border-white/[0.15] hover:bg-white/[0.05] transition-all"
      >
        <span className="text-white/50">DOT</span>
        <span className="text-white/80 font-mono">{dotBal}</span>
        <span className="text-white/20">|</span>
        <span className="text-white/40">1 DOT</span>
        <span className="text-polkadot-pink font-mono">= {topPrice}</span>
        <svg
          className={`h-3 w-3 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-white/[0.08] bg-[#1a1425] backdrop-blur-xl shadow-2xl z-50 animate-fade-in-up overflow-hidden">
          {/* Balances */}
          <div className="px-4 pt-3 pb-2">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Balances</div>
            <div className="space-y-1.5">
              {/* PAS native */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-polkadot-pink">PAS</span>
                <span className="text-xs text-white/70 font-mono">
                  {nativeBalance ? fmtBal(nativeBalance.value, nativeBalance.decimals) : "—"}
                </span>
              </div>
              {/* ERC20 tokens */}
              {TOKENS.map((token, i) => (
                <div key={token.symbol} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white/50">{token.symbol}</span>
                  <span className="text-xs text-white/70 font-mono">
                    {fmtBal(tokenBalances?.[i]?.result as bigint | undefined, token.decimals)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/[0.06] mx-3" />

          {/* Pools */}
          <div className="px-4 pt-2 pb-3">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Pools</div>
            <div className="space-y-1.5">
              {POOLS.map((pool, i) => {
                const result = poolData?.[i]?.result as [string, string, bigint, bigint] | undefined;
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
