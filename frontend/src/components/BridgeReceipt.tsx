"use client";

import { useState } from "react";
import type { BridgeReceipt } from "@/lib/types";

interface Props {
  receipt: BridgeReceipt;
}

export function BridgeReceiptCard({ receipt }: Props) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!receipt.beneficiarySS58) return;
    await navigator.clipboard.writeText(receipt.beneficiarySS58);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-polkadot-green/20 bg-polkadot-green/[0.03] backdrop-blur-xl p-5 glow-green">
      <div className="mb-4 flex items-center justify-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-polkadot-green/20">
          <svg className="h-3.5 w-3.5 text-polkadot-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-polkadot-green/70">
          Bridge Submitted
        </p>
      </div>

      <div className="mb-4 rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
        <div className="text-center space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">Bridged</p>
          <p className="text-lg font-bold text-white">
            {receipt.amountPAS} <span className="text-white/50">PAS</span>
          </p>
        </div>
        <div className="my-2 flex justify-center">
          <svg className="h-3.5 w-3.5 text-polkadot-cyan/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </div>
        <div className="text-center space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">To chain</p>
          <p className="text-sm font-semibold text-polkadot-cyan/80">
            {receipt.destinationChain}
          </p>
        </div>
      </div>

      {/* Relay address — copyable */}
      {receipt.beneficiarySS58 && (
        <div className="mb-3 rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/30 mb-1.5">Your address on relay chain</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 font-mono text-[11px] text-polkadot-cyan/80 break-all select-all">
              {receipt.beneficiarySS58}
            </p>
            <button
              onClick={copyAddress}
              className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] p-1.5 text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all"
              title="Copy address"
            >
              {copied ? (
                <svg className="h-3.5 w-3.5 text-polkadot-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 text-xs px-1">
        <div className="flex justify-between items-center">
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

      <p className="mt-3 text-center text-[10px] text-white/20">
        Funds arrive on {receipt.destinationChain} after XCM processing (~1-2 blocks)
      </p>
    </div>
  );
}
