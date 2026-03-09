"use client";

import type { SwapReceipt } from "@/lib/types";

interface Props {
  receipt: SwapReceipt;
}

const RISK_LABELS = ["GREEN", "YELLOW", "RED"] as const;
const RISK_COLORS = {
  GREEN: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", dot: "bg-green-400" },
  YELLOW: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", dot: "bg-yellow-400" },
  RED: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", dot: "bg-red-400" },
} as const;

export function SwapReceiptCard({ receipt }: Props) {
  const risk = receipt.onChainRisk;
  const riskLabel = risk ? RISK_LABELS[risk.riskLevel] ?? "GREEN" : null;
  const colors = riskLabel ? RISK_COLORS[riskLabel] : null;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-polkadot-green/20 bg-polkadot-green/[0.03] backdrop-blur-xl p-5 glow-green">
      <div className="mb-4 flex items-center justify-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-polkadot-green/20">
          <svg className="h-3.5 w-3.5 text-polkadot-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-polkadot-green/70">
          Swap Successful
        </p>
      </div>

      <div className="mb-4 rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
        <div className="text-center space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">Sent</p>
          <p className="text-lg font-bold text-white">
            {receipt.amountIn} <span className="text-white/50">{receipt.tokenFrom}</span>
          </p>
        </div>
        <div className="my-2 flex justify-center">
          <svg className="h-3.5 w-3.5 text-polkadot-green/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
        <div className="text-center space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">Received</p>
          <p className="text-lg font-bold text-polkadot-green">
            {receipt.amountOut} <span className="text-polkadot-green/50">{receipt.tokenTo}</span>
          </p>
        </div>
      </div>

      {risk && colors && riskLabel && (
        <div className={`mb-4 rounded-xl ${colors.bg} border ${colors.border} p-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                {riskLabel}
              </span>
              <span className="text-[11px] text-white/40">
                Score {risk.score}/100
              </span>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">
              On-chain verified
            </span>
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-white/40">
            <span>Impact: {(risk.priceImpact / 100).toFixed(2)}%</span>
            {risk.volatility > 0 && <span>Vol: {(risk.volatility / 100).toFixed(2)}%</span>}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center text-xs px-1">
        <span className="text-white/30">Transaction</span>
        <a
          href={receipt.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-polkadot-cyan/80 hover:text-polkadot-cyan transition-colors"
        >
          {receipt.txHash.slice(0, 10)}...{receipt.txHash.slice(-6)}
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>
    </div>
  );
}
