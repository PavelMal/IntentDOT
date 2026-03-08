"use client";

import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from "wagmi";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { polkadotHubTestnet } from "@/lib/wagmi";

export function ConnectWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, error: rawError } = useConnect();
  const [showError, setShowError] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const wasConnected = useRef(isConnected);

  // Redirect to /chat after wallet connection (only from landing page)
  useEffect(() => {
    if (!wasConnected.current && isConnected && pathname === "/") {
      router.push("/chat");
    }
    wasConnected.current = isConnected;
  }, [isConnected, pathname, router]);

  // Show error briefly, then auto-dismiss
  useEffect(() => {
    if (rawError) {
      setShowError(true);
      const t = setTimeout(() => setShowError(false), 4000);
      return () => clearTimeout(t);
    }
  }, [rawError]);
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

  const handleConnect = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const hasInjected = typeof window !== "undefined" && window.ethereum;

    if (isMobile && !hasInjected) {
      // Redirect to MetaMask mobile browser with deeplink
      const dappUrl = window.location.href;
      window.location.href = `https://metamask.app.link/dapp/${dappUrl.replace(/^https?:\/\//, "")}`;
      return;
    }

    // Use first available connector
    const connector = connectors[0];
    if (connector) connect({ connector });
  };

  return (
    <div className="relative flex flex-col items-end">
      <button
        onClick={handleConnect}
        className="rounded-xl bg-polkadot-pink px-5 py-2.5 text-sm font-semibold text-white hover:bg-polkadot-pink/80 transition-all hover:shadow-lg hover:shadow-polkadot-pink/20 active:scale-[0.98]"
      >
        Connect Wallet
      </button>
      {showError && rawError && (
        <div className="absolute top-full right-0 mt-2 flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-sm px-3 py-2 animate-fade-in-up whitespace-nowrap">
          <span className="text-[11px] text-yellow-300/70">
            {rawError.message.toLowerCase().includes("provider") ? (
              <>
                MetaMask not found.{" "}
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="underline text-polkadot-pink/80 hover:text-polkadot-pink">
                  Install →
                </a>
              </>
            ) : rawError.message.toLowerCase().includes("rejected") ? (
              "Connection cancelled"
            ) : (
              rawError.message.slice(0, 60)
            )}
          </span>
        </div>
      )}
    </div>
  );
}
