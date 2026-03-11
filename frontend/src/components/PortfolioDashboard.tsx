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

  const dotBal = fmtBal(tokenBalances?.[0]?.result as bigint | undefined, 18);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs hover:border-white/[0.15] hover:bg-white/[0.05] transition-all"
      >
        <svg className="h-3.5 w-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
        </svg>
        <span className="text-white/50">DOT</span>
        <span className="text-white/80 font-mono">{dotBal}</span>
        <svg
          className={`h-3 w-3 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-white/[0.08] bg-[#1a1425] backdrop-blur-xl shadow-2xl z-50 animate-fade-in-up overflow-hidden">
          <div className="px-4 pt-3 pb-3">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2.5">Balances</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-polkadot-pink">PAS</span>
                <span className="text-xs text-white/70 font-mono">
                  {nativeBalance ? fmtBal(nativeBalance.value, nativeBalance.decimals) : "—"}
                </span>
              </div>
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
        </div>
      )}
    </div>
  );
}
