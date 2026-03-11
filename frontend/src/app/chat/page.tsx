"use client";

import { ConnectWallet } from "@/components/ConnectWallet";
import { Chat } from "@/components/Chat";
import { PortfolioDashboard } from "@/components/PortfolioDashboard";
import { PoolInfo } from "@/components/PoolInfo";
import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import { polkadotHubTestnet } from "@/lib/wagmi";
import Link from "next/link";

export default function ChatPage() {
  const { isConnected, chain } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isCorrectChain = isConnected && chain?.id === polkadotHubTestnet.id;

  return (
    <main className="relative flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.06] px-6 py-4 glass">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Intent<span className="text-polkadot-pink">DOT</span>
            </h1>
            <span className="rounded-full border border-polkadot-pink/20 bg-polkadot-pink/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-polkadot-pink">
              AI DeFi
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ConnectWallet />
        </div>
      </header>

      {/* Portfolio + Pools */}
      {mounted && isCorrectChain && (
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.04] px-6 py-2.5 overflow-x-auto">
          <PortfolioDashboard />
          <PoolInfo />
        </div>
      )}

      {/* Content */}
      {!mounted ? null : isCorrectChain ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6">
          <Chat />
        </div>
      ) : isConnected ? (
        /* Wrong network */
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-500/10">
              <svg className="h-10 w-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">Wrong Network</h2>
            <p className="mb-6 text-sm text-white/50 leading-relaxed">
              IntentDOT runs on Polkadot Hub TestNet. Switch your network to continue.
            </p>
          </div>
        </div>
      ) : (
        /* Not connected */
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-polkadot-pink/20 bg-polkadot-pink/10">
              <svg className="h-10 w-10 text-polkadot-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">Connect Your Wallet</h2>
            <p className="mb-6 text-sm text-white/50 leading-relaxed">
              Connect MetaMask to start using IntentDOT on Polkadot Hub TestNet.
            </p>
            <ConnectWallet />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] px-6 py-3 text-center">
        <p className="text-[11px] text-white/20">
          Built on Polkadot Hub TestNet &middot; AI-powered DeFi Intent Solver
        </p>
      </footer>
    </main>
  );
}
