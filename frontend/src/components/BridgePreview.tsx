"use client";

import { useState } from "react";
import type { BridgePreview } from "@/lib/types";

interface Props {
  preview: BridgePreview;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
}

export function BridgePreviewCard({
  preview,
  onConfirm,
  onCancel,
  isExecuting = false,
}: Props) {
  const { intent, destinationChain, estimatedFees, minimumAmount, insufficientBalance } = preview;
  const isBlocked = !!insufficientBalance;
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Bridge Preview
        </p>
        <span className="rounded-full border border-polkadot-cyan/30 bg-polkadot-cyan/10 px-2.5 py-0.5 text-[10px] font-semibold text-polkadot-cyan">
          XCM Teleport
        </span>
      </div>

      {/* Bridge summary */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
        <div className="text-center space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">You bridge</p>
          <p className="text-2xl font-bold text-white">
            {intent.amount} <span className="text-lg text-white/60">PAS</span>
          </p>
        </div>
        <div className="my-3 flex justify-center">
          <div className="rounded-full border border-white/[0.08] bg-white/[0.04] p-1.5">
            <svg className="h-3.5 w-3.5 text-polkadot-cyan/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">To chain</p>
          <p className="text-sm font-semibold text-polkadot-cyan/80">
            {destinationChain}
          </p>
        </div>
      </div>

      {/* Fee info */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-3 space-y-1.5 text-xs text-white/40">
        <div className="flex justify-between">
          <span>Estimated fees</span>
          <span className="text-white/60">~{estimatedFees} PAS</span>
        </div>
        <div className="flex justify-between">
          <span>Minimum amount</span>
          <span className="text-white/60">{minimumAmount} PAS</span>
        </div>
        <div className="flex justify-between">
          <span>You receive (approx)</span>
          <span className="text-white/60">~{((intent.amount ?? 0) - parseFloat(estimatedFees)).toFixed(1)} PAS</span>
        </div>
      </div>

      {/* Insufficient balance warning */}
      {insufficientBalance && (
        <div className="rounded-xl border border-risk-red/30 bg-risk-red/10 px-4 py-3 text-center text-sm text-risk-red glow-red">
          <span className="font-semibold">Insufficient balance</span>
          <p className="mt-1 text-xs opacity-70">
            You have {insufficientBalance.have} PAS but need {insufficientBalance.need} PAS
          </p>
        </div>
      )}

      {/* Risk badge */}
      <div className="rounded-xl border border-polkadot-cyan/30 bg-polkadot-cyan/10 px-4 py-3 text-center text-sm font-semibold text-polkadot-cyan">
        XCM Teleport — Hub to {destinationChain}
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
          {insufficientBalance ? "Insufficient Balance" : isExecuting ? "Bridging..." : "Confirm Bridge"}
        </button>
      </div>
    </div>
  );
}
