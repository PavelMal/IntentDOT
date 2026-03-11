"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { mockERC20Abi } from "@/lib/abis";

const TOKENS = [
  { symbol: "DOT", address: CONTRACTS.dotToken, decimals: 18 },
  { symbol: "USDT", address: CONTRACTS.usdtToken, decimals: 18 },
  { symbol: "USDC", address: CONTRACTS.usdcToken, decimals: 18 },
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

export function PortfolioDashboard() {
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  if (!address) return null;

  const allBalances = [
    { symbol: "PAS", value: nativeBalance ? fmtBal(nativeBalance.value, nativeBalance.decimals) : "—", highlight: true },
    ...TOKENS.map((t, i) => ({
      symbol: t.symbol,
      value: fmtBal(tokenBalances?.[i]?.result as bigint | undefined, t.decimals),
      highlight: false,
    })),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs hover:border-white/[0.15] hover:bg-white/[0.05] transition-all"
      >
        {/* Coins icon */}
        <svg className="h-3.5 w-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
        <span className="text-white/50">Balances</span>
        <svg
          className={`h-3 w-3 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-white/[0.08] bg-[#1a1425] backdrop-blur-xl shadow-2xl z-50 animate-fade-in-up overflow-hidden">
          <div className="px-4 pt-3 pb-3 space-y-2">
            {allBalances.map((b) => (
              <div key={b.symbol} className="flex items-center justify-between">
                <span className={`text-xs font-medium ${b.highlight ? "text-polkadot-pink" : "text-white/50"}`}>
                  {b.symbol}
                </span>
                <span className="text-xs text-white/70 font-mono">{b.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
