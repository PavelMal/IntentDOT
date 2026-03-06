"use client";

import { useState } from "react";
import type { TransferPreview } from "@/lib/types";

interface Props {
  preview: TransferPreview;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
}

export function TransferPreviewCard({
  preview,
  onConfirm,
  onCancel,
  isExecuting = false,
}: Props) {
  const { intent, insufficientBalance } = preview;
  const isBlocked = !!insufficientBalance;
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Transfer Preview
        </p>
      </div>

      {/* Transfer summary */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
        <div className="text-center space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">You send</p>
          <p className="text-2xl font-bold text-white">
            {intent.amount} <span className="text-lg text-white/60">{intent.token_from}</span>
          </p>
        </div>
        <div className="my-3 flex justify-center">
          <div className="rounded-full border border-white/[0.08] bg-white/[0.04] p-1.5">
            <svg className="h-3.5 w-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">To address</p>
          <p className="text-sm font-mono text-polkadot-cyan/80 break-all">
            {intent.recipient}
          </p>
        </div>
      </div>

      {/* Insufficient balance warning */}
      {insufficientBalance && (
        <div className="rounded-xl border border-risk-red/30 bg-risk-red/10 px-4 py-3 text-center text-sm text-risk-red glow-red">
          <span className="font-semibold">Insufficient balance</span>
          <p className="mt-1 text-xs opacity-70">
            You have {insufficientBalance.have} {intent.token_from} but need {insufficientBalance.need} {intent.token_from}
          </p>
        </div>
      )}

      {/* Risk badge - transfers are generally low risk */}
      <div className="rounded-xl border border-risk-green/30 bg-risk-green/10 px-4 py-3 text-center text-sm font-semibold text-risk-green glow-green">
        ✅ LOW RISK — Direct Transfer
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={() => {
            setDismissed(true);
            onCancel();
          }}
          disabled={isExecuting}
          className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all disabled:opacity-30"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isBlocked || isExecuting}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all ${
            isBlocked
              ? "bg-risk-red/20 border border-risk-red/30 cursor-not-allowed opacity-50"
              : isExecuting
                ? "bg-polkadot-pink/40 cursor-wait"
                : "bg-polkadot-pink hover:bg-polkadot-pink/80 hover:shadow-lg hover:shadow-polkadot-pink/20 active:scale-[0.98]"
          }`}
        >
          {insufficientBalance ? "Insufficient Balance" : isExecuting ? "Executing..." : "Confirm Transfer"}
        </button>
      </div>
    </div>
  );
}
