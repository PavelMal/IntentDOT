"use client";

import { useAccount, useBalance, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { mockERC20Abi } from "@/lib/abis";

const TOKENS = [
  { symbol: "DOT", address: CONTRACTS.dotToken, decimals: 18 },
  { symbol: "USDT", address: CONTRACTS.usdtToken, decimals: 18 },
  { symbol: "USDC", address: CONTRACTS.usdcToken, decimals: 18 },
] as const;

function formatBalance(value: bigint | undefined, decimals: number): string {
  if (value === undefined) return "—";
  const num = parseFloat(formatUnits(value, decimals));
  if (num === 0) return "0";
  if (num < 0.01) return "<0.01";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(2);
}

export function PortfolioDashboard() {
  const { address } = useAccount();

  // Native PAS balance
  const { data: nativeBalance } = useBalance({
    address,
    query: { refetchInterval: 12_000 },
  });

  // ERC20 balances via multicall
  const { data: tokenBalances } = useReadContracts({
    contracts: TOKENS.map((t) => ({
      address: t.address,
      abi: mockERC20Abi,
      functionName: "balanceOf",
      args: [address!],
    })),
    query: {
      enabled: !!address,
      refetchInterval: 12_000,
    },
  });

  if (!address) return null;

  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      {/* PAS native */}
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 min-w-fit">
        <span className="text-xs font-medium text-polkadot-pink">PAS</span>
        <span className="text-xs text-white/70 font-mono">
          {nativeBalance ? formatBalance(nativeBalance.value, nativeBalance.decimals) : "—"}
        </span>
      </div>

      {/* ERC20 tokens */}
      {TOKENS.map((token, i) => (
        <div
          key={token.symbol}
          className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 min-w-fit"
        >
          <span className="text-xs font-medium text-white/50">{token.symbol}</span>
          <span className="text-xs text-white/70 font-mono">
            {formatBalance(
              tokenBalances?.[i]?.result as bigint | undefined,
              token.decimals
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
