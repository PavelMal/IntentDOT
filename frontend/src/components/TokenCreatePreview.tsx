"use client";

import { useState } from "react";
import type { TokenCreatePreview } from "@/lib/types";

interface Props {
  preview: TokenCreatePreview;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
}

export function TokenCreatePreviewCard({
  preview,
  onConfirm,
  onCancel,
  isExecuting = false,
}: Props) {
  const { intent } = preview;
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Create Token Preview
        </p>
      </div>

      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-white/35">Name</span>
          <span className="text-white font-medium">{intent.tokenName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/35">Symbol</span>
          <span className="text-white font-medium">{intent.tokenSymbol}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/35">Initial Supply</span>
          <span className="text-white font-medium">{intent.initialSupply?.toLocaleString()}</span>
        </div>
      </div>

      <div className="rounded-xl border border-polkadot-cyan/30 bg-polkadot-cyan/10 px-4 py-3 text-center text-sm text-polkadot-cyan/80">
        Token will be minted to your wallet and auto-whitelisted for trading
      </div>

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
          disabled={isExecuting}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all ${
            isExecuting
              ? "bg-polkadot-pink/40 cursor-wait"
              : "bg-polkadot-pink hover:bg-polkadot-pink/80 hover:shadow-lg hover:shadow-polkadot-pink/20 active:scale-[0.98]"
          }`}
        >
          {isExecuting ? "Creating..." : "Create Token"}
        </button>
      </div>
    </div>
  );
}
