"use client";

import type { TokenCreateReceipt } from "@/lib/types";

interface Props {
  receipt: TokenCreateReceipt;
}

export function TokenCreateReceiptCard({ receipt }: Props) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-polkadot-green/20 bg-polkadot-green/[0.03] backdrop-blur-xl p-5 glow-green">
      <div className="mb-4 flex items-center justify-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-polkadot-green/20">
          <svg className="h-3.5 w-3.5 text-polkadot-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-polkadot-green/70">
          Token Created
        </p>
      </div>

      <div className="mb-4 rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-white/35">Name</span>
          <span className="text-white font-medium">{receipt.tokenName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/35">Symbol</span>
          <span className="text-white font-medium">{receipt.tokenSymbol}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/35">Supply</span>
          <span className="text-white font-medium">{receipt.initialSupply.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/35">Contract</span>
          <span className="font-mono text-xs text-polkadot-cyan/80 break-all">
            {receipt.tokenAddress}
          </span>
        </div>
      </div>

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
