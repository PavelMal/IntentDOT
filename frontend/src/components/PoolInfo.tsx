"use client";

import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { mockDexAbi } from "@/lib/abis";

const POOLS = [
  { name: "DOT / USDT", tokenA: CONTRACTS.dotToken, tokenB: CONTRACTS.usdtToken },
  { name: "DOT / USDC", tokenA: CONTRACTS.dotToken, tokenB: CONTRACTS.usdcToken },
] as const;

function fmt(value: bigint | undefined): string {
  if (value === undefined) return "—";
  const num = parseFloat(formatUnits(value, 18));
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

function price(reserveA: bigint | undefined, reserveB: bigint | undefined): string {
  if (!reserveA || !reserveB || reserveA === 0n) return "—";
  const p = Number(reserveB) / Number(reserveA);
  return p.toFixed(2);
}

export function PoolInfo() {
  const { data } = useReadContracts({
    contracts: POOLS.map((p) => ({
      address: CONTRACTS.mockDex,
      abi: mockDexAbi,
      functionName: "getPool",
      args: [p.tokenA, p.tokenB],
    })),
    query: { refetchInterval: 12_000 },
  });

  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      {POOLS.map((pool, i) => {
        const result = data?.[i]?.result as [string, string, bigint, bigint] | undefined;
        const reserve0 = result?.[2];
        const reserve1 = result?.[3];

        return (
          <div
            key={pool.name}
            className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 min-w-fit"
          >
            <span className="text-xs font-medium text-white/60">{pool.name}</span>
            <span className="text-xs text-polkadot-pink font-mono">
              {price(reserve0, reserve1)}
            </span>
            <span className="text-[10px] text-white/30">
              {fmt(reserve0)} / {fmt(reserve1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
