"use client";

import { useState, useRef, useEffect } from "react";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";

const EXPLORER = "https://blockscout-testnet.polkadot.io/tx/";

export function TransactionHistory({ externalRefreshRef }: { externalRefreshRef?: React.MutableRefObject<(() => void) | null> }) {
  const { entries, loading, refresh } = useTransactionHistory();

  // Expose refresh to parent so Chat can trigger it after swap/transfer
  useEffect(() => {
    if (externalRefreshRef) externalRefreshRef.current = refresh;
    return () => { if (externalRefreshRef) externalRefreshRef.current = null; };
  }, [externalRefreshRef, refresh]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) refresh(); }}
        className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs hover:border-white/[0.15] hover:bg-white/[0.05] transition-all"
      >
        {/* Clock icon */}
        <svg className="h-3.5 w-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <span className="text-white/50">History</span>
        {entries.length > 0 && (
          <span className="rounded-full bg-polkadot-pink/20 text-polkadot-pink text-[10px] font-medium px-1.5 min-w-[18px] text-center">
            {entries.length}
          </span>
        )}
        <svg
          className={`h-3 w-3 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-80 rounded-2xl border border-white/[0.08] bg-[#1a1425] backdrop-blur-xl shadow-2xl z-50 animate-fade-in-up overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-white/30">On-chain History</span>
            <button
              onClick={refresh}
              disabled={loading}
              className="text-[10px] text-white/30 hover:text-white/60 disabled:opacity-30 transition-colors"
            >
              {loading ? "..." : "Refresh"}
            </button>
          </div>

          <div className="overflow-y-auto max-h-64">
            {entries.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-white/25">
                {loading ? "Loading..." : "No transactions yet"}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {entries.map((e) => (
                  <a
                    key={e.txHash}
                    href={`${EXPLORER}${e.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-white/60">
                        {e.intentType === "swap" ? "Swap" : e.intentType === "transfer" ? "Transfer" : e.intentType === "create_token" ? "Create Token" : e.intentType === "bridge" ? "Bridge" : e.intentType}
                      </span>
                      <span className="text-[11px] text-white/35">
                        {e.intentType === "create_token"
                          ? `${e.tokenIn} — ${e.amountIn} supply`
                          : e.intentType === "transfer"
                            ? `${e.amountIn} ${e.tokenIn} to ${e.tokenOut}`
                            : e.intentType === "bridge"
                              ? `${e.amountIn ? e.amountIn + " " : ""}${e.tokenIn} → ${e.tokenOut}`
                              : `${e.amountIn} ${e.tokenIn} → ${e.amountOut} ${e.tokenOut}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/20 font-mono">
                        {e.txHash.slice(0, 8)}...
                      </span>
                      <svg className="h-3 w-3 text-white/20 group-hover:text-white/40 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
