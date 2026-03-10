"use client";

import { useState, useEffect, useCallback } from "react";
import type { TransactionPreview, RiskLevel } from "@/lib/types";

const QUOTE_TTL_SECONDS = 30;

const riskConfig: Record<RiskLevel, { bg: string; label: string; icon: string; glow: string }> = {
  GREEN: {
    bg: "border-risk-green/30 bg-risk-green/10 text-risk-green",
    label: "LOW RISK",
    icon: "\u2705",
    glow: "glow-green",
  },
  YELLOW: {
    bg: "border-risk-yellow/30 bg-risk-yellow/10 text-risk-yellow",
    label: "MEDIUM RISK",
    icon: "\u26A0\uFE0F",
    glow: "glow-yellow",
  },
  RED: {
    bg: "border-risk-red/30 bg-risk-red/10 text-risk-red",
    label: "HIGH RISK \u2014 BLOCKED",
    icon: "\uD83D\uDED1",
    glow: "glow-red",
  },
};

interface Props {
  preview: TransactionPreview;
  onConfirm: () => void;
  onCancel: () => void;
  onRefresh?: () => void;
  isExecuting?: boolean;
}

export function TransactionPreviewCard({
  preview,
  onConfirm,
  onCancel,
  onRefresh,
  isExecuting = false,
}: Props) {
  const { intent, amountOut, risk, insufficientBalance } = preview;
  const isBlocked = risk.level === "RED" || !!insufficientBalance;
  const config = riskConfig[risk.level];
  const [dismissed, setDismissed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(QUOTE_TTL_SECONDS);
  const [showRiskInfo, setShowRiskInfo] = useState(false);
  const isExpired = secondsLeft <= 0;

  useEffect(() => {
    setSecondsLeft(QUOTE_TTL_SECONDS);
  }, [preview]);

  useEffect(() => {
    if (isExecuting || dismissed) return;
    if (secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, isExecuting, dismissed]);

  const handleRefresh = useCallback(() => {
    setSecondsLeft(QUOTE_TTL_SECONDS);
    onRefresh?.();
  }, [onRefresh]);

  if (dismissed) return null;

  // Timer progress for the circular indicator
  const progress = secondsLeft / QUOTE_TTL_SECONDS;
  const circumference = 2 * Math.PI * 10;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-5 space-y-4">
      {/* Header with timer */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Transaction Preview
        </p>
        {!isExecuting && (
          <div className="flex items-center gap-1.5">
            {isExpired ? (
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/50 hover:text-white/70 hover:bg-white/10 transition-all"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                Refresh
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <svg className="h-5 w-5 -rotate-90" viewBox="0 0 24 24">
                  {/* Background circle */}
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"
                    className="text-white/[0.06]" />
                  {/* Progress circle */}
                  <circle cx="12" cy="12" r="10" fill="none" strokeWidth="2"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className={secondsLeft <= 5 ? "text-risk-yellow" : "text-white/20"}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <span className={`text-[11px] font-mono tabular-nums ${secondsLeft <= 5 ? "text-risk-yellow" : "text-white/30"}`}>
                  {secondsLeft}s
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Swap summary */}
      <div className={`rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 ${isExpired && !isExecuting ? "opacity-50" : ""}`}>
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
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">You receive</p>
          <p className="text-2xl font-bold text-polkadot-green">
            {amountOut} <span className="text-lg text-polkadot-green/60">{intent.token_to}</span>
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2 px-1">
        <div className="flex justify-between text-xs">
          <span className="text-white/35">Slippage</span>
          <span className={risk.slippage > 0.03 ? "text-risk-yellow font-medium" : "text-white/60"}>
            {(risk.slippage * 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/35">Price Impact</span>
          <span className={risk.priceImpact > 0.05 ? "text-risk-red font-medium" : "text-white/60"}>
            {(risk.priceImpact * 100).toFixed(2)}%
          </span>
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

      {/* Risk badge */}
      <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${config.bg} ${config.glow}`}>
        <div className="flex items-center justify-between">
          <span>{config.icon} {config.label}</span>
          <div className="relative">
            <button
              onClick={() => setShowRiskInfo(!showRiskInfo)}
              className="flex items-center gap-1 text-[10px] font-medium text-white/50 hover:text-white/80 transition-colors"
            >
              <span className="uppercase tracking-wider">How is this calculated?</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </button>

            {showRiskInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRiskInfo(false)} />
                <div className="absolute right-0 bottom-8 z-50 w-72 rounded-xl border border-white/10 bg-[#1a1a2e] p-4 shadow-2xl text-left font-normal">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-white/80">AI Risk Guardian</p>
                    <button onClick={() => setShowRiskInfo(false)} className="text-white/30 hover:text-white/60">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/50 mb-3">
                    Before you confirm, the AI evaluates your swap off-chain using real pool data. It checks three factors:
                  </p>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-polkadot-cyan/60">1.</span>
                      <p className="text-white/50">
                        <span className="text-white/70 font-medium">Slippage</span> — difference between expected and actual output amount
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-polkadot-cyan/60">2.</span>
                      <p className="text-white/50">
                        <span className="text-white/70 font-medium">Price Impact</span> — how much your trade moves the pool price
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-polkadot-cyan/60">3.</span>
                      <p className="text-white/50">
                        <span className="text-white/70 font-medium">Pool Drain</span> — what % of pool liquidity your swap uses
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      <span className="text-white/40">GREEN — Safe to swap</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                      <span className="text-white/40">YELLOW — Elevated risk, proceed with caution</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      <span className="text-white/40">RED — Blocked (slippage {">"}10% or pool drain {">"}30%)</span>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] text-white/30">
                    This is a pre-swap check. After confirmation, a Rust smart contract on PolkaVM performs a second independent check on-chain.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        {risk.reasons.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs font-normal opacity-70">
            {risk.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
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
        {isExpired && !isExecuting ? (
          <button
            onClick={handleRefresh}
            className="flex-1 rounded-xl bg-polkadot-pink py-2.5 text-sm font-semibold text-white hover:bg-polkadot-pink/80 transition-all hover:shadow-lg hover:shadow-polkadot-pink/20 active:scale-[0.98]"
          >
            Refresh Quote
          </button>
        ) : (
          <button
            onClick={onConfirm}
            disabled={isBlocked || isExecuting || isExpired}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all ${
              isBlocked
                ? "bg-risk-red/20 border border-risk-red/30 cursor-not-allowed opacity-50"
                : isExecuting
                  ? "bg-polkadot-pink/40 cursor-wait"
                  : "bg-polkadot-pink hover:bg-polkadot-pink/80 hover:shadow-lg hover:shadow-polkadot-pink/20 active:scale-[0.98]"
            }`}
          >
            {insufficientBalance ? "Insufficient Balance" : isBlocked ? "Blocked" : isExecuting ? "Executing..." : "Confirm Swap"}
          </button>
        )}
      </div>
    </div>
  );
}
