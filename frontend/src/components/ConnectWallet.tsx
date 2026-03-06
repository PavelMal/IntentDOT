"use client";

import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { useState, useEffect } from "react";
import { polkadotHubTestnet } from "@/lib/wagmi";

export function ConnectWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isWrongChain = isConnected && chain?.id !== polkadotHubTestnet.id;

  if (!mounted) {
    return (
      <button className="rounded-xl bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-medium text-white/30" disabled>
        Connect Wallet
      </button>
    );
  }

  if (isConnected && isWrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: polkadotHubTestnet.id })}
        className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-medium text-yellow-400 hover:bg-yellow-500/20 transition-all"
      >
        <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
        Switch to Polkadot Hub
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {balance && (
          <span className="hidden sm:inline rounded-lg bg-white/5 border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/50">
            {parseFloat(balance.formatted).toFixed(2)} {balance.symbol}
          </span>
        )}
        <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/[0.06]">
          <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-white/70">
            <span className="h-2 w-2 rounded-full bg-polkadot-green" />
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <button
            onClick={() => disconnect()}
            className="border-l border-white/[0.06] px-3 py-2 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            &times;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => connect({ connector: injected() })}
        className="rounded-xl bg-polkadot-pink px-5 py-2.5 text-sm font-semibold text-white hover:bg-polkadot-pink/80 transition-all hover:shadow-lg hover:shadow-polkadot-pink/20 active:scale-[0.98]"
      >
        Connect Wallet
      </button>
      {error && (
        <span className="text-[11px] text-red-400/80 max-w-[280px] text-right">
          {error.message.toLowerCase().includes("provider") ? (
            <>
              MetaMask not found.{" "}
              <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="underline hover:text-red-300">
                Install
              </a>
            </>
          ) : (
            error.message.slice(0, 80)
          )}
        </span>
      )}
    </div>
  );
}
