import { decodeEventLog } from "viem";
import { intentExecutorAbi } from "./abis";
import type { OnChainRisk } from "./types";

// --- Risk Level Labels & Colors ---

export const RISK_LABELS = ["GREEN", "YELLOW", "RED"] as const;
export type RiskLabel = (typeof RISK_LABELS)[number];

export const RISK_COLORS = {
  GREEN: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", dot: "bg-green-400" },
  YELLOW: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", dot: "bg-yellow-400" },
  RED: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", dot: "bg-red-400" },
} as const;

/** Map numeric risk level (0/1/2) to label. Defaults to GREEN for out-of-range. */
export function getRiskLabel(riskLevel: number): RiskLabel {
  return RISK_LABELS[riskLevel] ?? "GREEN";
}

/** Get color classes for a risk label. */
export function getRiskColors(label: RiskLabel) {
  return RISK_COLORS[label];
}

/** Format basis points as percentage string (e.g. 150 → "1.50") */
export function formatBps(bps: number): string {
  return (bps / 100).toFixed(2);
}

// --- Event Parsing ---

export interface RawLog {
  data: `0x${string}`;
  topics: [`0x${string}`, ...`0x${string}`[]];
}

/** Parse RiskChecked event from transaction receipt logs. Returns undefined if not found. */
export function parseRiskCheckedEvent(logs: RawLog[]): OnChainRisk | undefined {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: intentExecutorAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "RiskChecked") {
        const args = decoded.args as {
          riskLevel: number;
          score: bigint;
          priceImpact: bigint;
          volatility: bigint;
        };
        return {
          riskLevel: args.riskLevel,
          score: Number(args.score),
          priceImpact: Number(args.priceImpact),
          volatility: Number(args.volatility),
        };
      }
    } catch {
      // Not a RiskChecked event, skip
    }
  }
  return undefined;
}
