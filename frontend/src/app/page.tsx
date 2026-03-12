"use client";

import { ConnectWallet } from "@/components/ConnectWallet";
import { useAccount } from "wagmi";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

/* ── Scroll Animation Hook ─────────────────────────────── */
function useScrollAnimation(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = container.querySelectorAll(".animate-on-scroll");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [active]);

  return containerRef;
}

/* ── Feature Icon SVGs ──────────────────────────────────── */
function FeatureIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    chat: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    shield: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    lock: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    bridge: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    sparkle: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
    ),
    chart: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    history: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  };
  return <>{icons[name]}</>;
}

/* ── Feature Data ───────────────────────────────────────── */
const features = [
  { icon: "chat", title: "Natural Language DeFi", desc: "Type what you want in plain English. Swap tokens, send transfers, create tokens, or bridge cross-chain — all from one chat.", borderColor: "border-polkadot-pink/30", bgColor: "bg-polkadot-pink/10", textColor: "text-polkadot-pink" },
  { icon: "shield", title: "AI Risk Guardian", desc: "Off-chain AI pre-check: scores slippage, liquidity, and pool drain risk before you confirm. GREEN / YELLOW / RED rating.", borderColor: "border-polkadot-green/30", bgColor: "bg-polkadot-green/10", textColor: "text-polkadot-green" },
  { icon: "lock", title: "Rust Risk Engine", desc: "On-chain Rust smart contract on PolkaVM. Validates every swap by price impact, MA20 deviation, and volatility. RED = automatic revert.", borderColor: "border-[#DEA584]/30", bgColor: "bg-[#DEA584]/10", textColor: "text-[#DEA584]" },
  { icon: "bridge", title: "XCM Cross-Chain Bridge", desc: "Bridge PAS tokens from Polkadot Hub to Relay Chain via XCM. One command, fully on-chain teleport.", borderColor: "border-polkadot-cyan/30", bgColor: "bg-polkadot-cyan/10", textColor: "text-polkadot-cyan" },
  { icon: "sparkle", title: "Token Factory", desc: "Create your own ERC-20 token in seconds. Just describe the name, symbol, and supply — auto-whitelisted for trading.", borderColor: "border-polkadot-purple/30", bgColor: "bg-polkadot-purple/10", textColor: "text-polkadot-purple" },
  { icon: "chart", title: "Live Portfolio & Markets", desc: "Real-time token balances, pool reserves, live prices, and mini price charts with sparklines — all in the header.", borderColor: "border-yellow-500/30", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400" },
];

/* ── Steps Data ─────────────────────────────────────────── */
const steps = [
  { num: "01", title: "Describe Your Intent", desc: "Type naturally: \"Swap 100 DOT for USDT\" or \"Send 50 USDC to 0xabc...\"" },
  { num: "02", title: "AI Reviews & Scores", desc: "Risk Guardian evaluates slippage, liquidity, and pool health. You see a GREEN / YELLOW / RED score." },
  { num: "03", title: "One-Click Execute", desc: "Preview the full transaction details, confirm with one click, and watch it execute on-chain." },
];

/* ── Roadmap Data ───────────────────────────────────────── */
const roadmapPhases = [
  {
    phase: "v1",
    label: "Now",
    badgeColor: "border-polkadot-green/30 bg-polkadot-green/10 text-polkadot-green",
    items: [
      { text: "Natural Language Swaps", desc: "Type \"swap 100 DOT to USDT\" in plain English. AI parses your intent and builds the transaction automatically.", track: "evm" as const },
      { text: "AI Risk Guardian", desc: "AI scores every swap by price impact, volatility, and liquidity. GREEN = safe, YELLOW = warning, RED = blocked.", track: "evm" as const },
      { text: "Token Transfers", desc: "Send tokens to any address with natural language. \"Send 50 USDT to 0x...\" — parsed and executed in one step.", track: "evm" as const },
      { text: "Token Factory", desc: "Deploy your own ERC-20 token with a chat command. Auto-whitelisted on MockDEX for immediate trading.", track: "evm" as const },
      { text: "Portfolio & History", desc: "Real-time token balances and full transaction log pulled from blockchain events.", track: "evm" as const },
      { text: "Rust Risk Engine", desc: "Rust smart contract on PolkaVM that scores every swap by price impact, MA20 deviation, and volatility. RED = automatic revert.", track: "pvm" as const },
      { text: "XCM Cross-Chain Bridge", desc: "Transfer tokens between Polkadot chains via XCM Precompile. Natural language command to XCM teleport in one click.", track: "pvm" as const },
    ],
  },
  {
    phase: "v2",
    label: "April 2026",
    badgeColor: "border-white/20 bg-white/[0.06] text-white/70",
    items: [
      { text: "EIP-7702 Smooth Mode", desc: "Account abstraction via EIP-7702. No more MetaMask popups — transactions feel like Web2.", track: "evm" as const },
      { text: "NFT Trading", desc: "Buy, sell, and transfer NFTs through natural language. AI handles marketplace interaction.", track: "evm" as const },
      { text: "People Chain Identity", desc: "Send tokens by name instead of address. \"Send 50 USDT to Alice\" — resolves People Chain identity to wallet address.", track: "evm" as const },
      { text: "Multi-Pool Correlation", desc: "Analyze correlations between pools. If DOT/USDT drops but DOT/USDC doesn't — likely manipulation, not a real price move.", track: "pvm" as const },
      { text: "Oracle Price Feeds", desc: "Compare on-chain pool price with external oracle (Chainlink/DIA). Large deviation = pool is manipulated or stale.", track: "pvm" as const },
      { text: "Dynamic Risk Thresholds", desc: "Adaptive risk thresholds based on pool maturity. New pools get stricter limits; mature pools get more lenient scoring.", track: "pvm" as const },
    ],
  },
  {
    phase: "v3",
    label: "June 2026",
    badgeColor: "border-white/20 bg-white/[0.06] text-white/70",
    items: [
      { text: "AI Trading Strategies", desc: "Describe your strategy in plain English: \"Buy 10 DOT daily if price is below 1 USDT\". AI executes it on schedule.", track: "evm" as const },
      { text: "Liquidity Provision", desc: "Add liquidity to pools via natural language. AI calculates optimal amounts, warns about impermanent loss risk.", track: "evm" as const },
      { text: "DEX Aggregation", desc: "Route swaps across multiple DEXes for best price. AI compares rates and splits orders automatically.", track: "evm" as const },
      { text: "MEV Protection On-Chain", desc: "Detect frontrunning and sandwich attacks on-chain. Risk Engine flags suspicious transaction ordering.", track: "pvm" as const },
      { text: "Cross-Chain Risk via XCM", desc: "Send risk scores to other parachains via XCM. Risk-as-a-service across Polkadot.", track: "pvm" as const },
      { text: "Governance Risk Parameters", desc: "Move risk parameters into on-chain governance. Community votes to adjust scoring without redeploying.", track: "pvm" as const },
    ],
  },
];

/* ── Roadmap Item (click to expand) ────────────────────── */
function RoadmapItem({ item }: { item: { text: string; desc: string; track: "evm" | "pvm" } }) {
  const [open, setOpen] = useState(false);
  const isEvm = item.track === "evm";
  return (
    <button
      onClick={() => setOpen(!open)}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
        isEvm
          ? "border-[#E6007A]/20 bg-[#E6007A]/[0.04] hover:bg-[#E6007A]/[0.08]"
          : "border-[#DEA584]/25 bg-[#DEA584]/[0.04] hover:bg-[#DEA584]/[0.08]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-medium ${isEvm ? "text-[#E6007A]/85" : "text-[#DEA584]"}`}>
          {item.text}
        </span>
        <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""} ${isEvm ? "text-[#E6007A]/40" : "text-[#DEA584]/40"}`}>
          ▼
        </span>
      </div>
      {open && (
        <p className="mt-2 text-xs leading-relaxed text-white/50">{item.desc}</p>
      )}
    </button>
  );
}

/* ── Animated Demo ─────────────────────────────────────── */
const DEMO_TEXT = "Swap 100 DOT for USDT";
const TYPING_SPEED = 70; // ms per char
const PAUSE_AFTER_TYPE = 600;
const AI_THINKING_TIME = 1500;
const PREVIEW_DISPLAY_TIME = 1800;
const CONFIRMING_TIME = 2000;
const SUCCESS_DISPLAY_TIME = 3000;
const PAUSE_BEFORE_RESTART = 1000;

type DemoPhase = "typing" | "thinking" | "preview" | "confirming" | "success" | "reset";

function AnimatedDemo() {
  const [phase, setPhase] = useState<DemoPhase>("typing");
  const [charIndex, setCharIndex] = useState(0);
  const [timerValue, setTimerValue] = useState(30);
  const [elapsed, setElapsed] = useState(0);
  const [confirmClicked, setConfirmClicked] = useState(false);

  // typing(~2070) + thinking(1500) + preview(1800+400) + confirming(2000) + success(3000) + reset(1000)
  const TOTAL_CYCLE = 11800;
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed((e) => (e >= TOTAL_CYCLE ? 0 : e + 100));
    }, 100);
    return () => clearInterval(t);
  }, []);

  // Typing effect
  useEffect(() => {
    if (phase !== "typing") return;
    if (charIndex >= DEMO_TEXT.length) {
      const t = setTimeout(() => setPhase("thinking"), PAUSE_AFTER_TYPE);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCharIndex((i) => i + 1), TYPING_SPEED);
    return () => clearTimeout(t);
  }, [phase, charIndex]);

  // AI thinking → preview
  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setTimeout(() => {
      setPhase("preview");
      setTimerValue(30);
      setConfirmClicked(false);
    }, AI_THINKING_TIME);
    return () => clearTimeout(t);
  }, [phase]);

  // Preview → auto-click confirm after delay
  useEffect(() => {
    if (phase !== "preview") return;
    const clickDelay = setTimeout(() => {
      setConfirmClicked(true);
      const confirmDelay = setTimeout(() => setPhase("confirming"), 400);
      return () => clearTimeout(confirmDelay);
    }, PREVIEW_DISPLAY_TIME);
    return () => clearTimeout(clickDelay);
  }, [phase]);

  // Preview timer countdown (visual only)
  useEffect(() => {
    if (phase !== "preview" && phase !== "confirming") return;
    if (timerValue <= 0) return;
    const t = setTimeout(() => setTimerValue((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timerValue]);

  // Confirming → success
  useEffect(() => {
    if (phase !== "confirming") return;
    const t = setTimeout(() => setPhase("success"), CONFIRMING_TIME);
    return () => clearTimeout(t);
  }, [phase]);

  // Success → reset
  useEffect(() => {
    if (phase !== "success") return;
    const t = setTimeout(() => setPhase("reset"), SUCCESS_DISPLAY_TIME);
    return () => clearTimeout(t);
  }, [phase]);

  // Reset → restart loop
  useEffect(() => {
    if (phase !== "reset") return;
    const t = setTimeout(() => {
      setCharIndex(0);
      setElapsed(0);
      setConfirmClicked(false);
      setPhase("typing");
    }, PAUSE_BEFORE_RESTART);
    return () => clearTimeout(t);
  }, [phase]);

  const displayedText = DEMO_TEXT.slice(0, charIndex);
  const progress = timerValue / 30;
  const circumference = 2 * Math.PI * 10;
  const strokeDashoffset = circumference * (1 - progress);

  const progressPct = Math.min((elapsed / TOTAL_CYCLE) * 100, 100);

  return (
    <div className="animate-fade-in-up w-full max-w-md" style={{ animationDelay: "0.4s" }}>
      {/* Demo badge + progress */}
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-polkadot-pink/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-polkadot-pink" />
          </span>
          <span className="text-[11px] font-medium text-white/40">Live Demo</span>
        </div>
        <span className="text-[10px] text-white/20">
          {phase === "typing" ? "User typing..." : phase === "thinking" ? "AI analyzing..." : phase === "preview" ? "Preview ready" : phase === "confirming" ? "On-chain verification..." : phase === "success" ? "✓ On-chain verified" : ""}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-[2px] w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-polkadot-pink to-polkadot-purple transition-all duration-100 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Fixed-height container to prevent layout jumps */}
      <div style={{ height: 510 }}>
      {/* Chat input simulation */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-xl bg-white/[0.05] border border-white/[0.08] px-4 py-3 min-h-[44px]">
            <span className="text-sm text-white/80">{displayedText}</span>
            {phase === "typing" && (
              <span className="inline-block w-[2px] h-4 bg-polkadot-pink ml-0.5 align-middle animate-blink" />
            )}
          </div>
          <button
            className={`rounded-xl p-3 transition-all ${
              phase === "typing" && charIndex >= DEMO_TEXT.length
                ? "bg-polkadot-pink text-white"
                : charIndex > 0 ? "bg-polkadot-pink/60 text-white/60" : "bg-white/[0.05] text-white/20"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* AI thinking indicator */}
      <div className={`mt-3 flex items-start gap-3 px-2 transition-opacity duration-300 ${phase === "thinking" ? "opacity-100" : "opacity-0 pointer-events-none"}`} style={{ height: 40 }}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-polkadot-pink/10 border border-polkadot-pink/20">
          <svg className="h-3.5 w-3.5 text-polkadot-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        </div>
        <div className="rounded-2xl rounded-tl-md bg-white/[0.04] border border-white/[0.06] px-4 py-3">
          <div className="dot-pulse flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </div>
        </div>
      </div>

      {/* Transaction Preview Card */}
      <div className={`mt-3 rounded-2xl border bg-white/[0.03] backdrop-blur-xl p-5 space-y-4 transition-opacity duration-500 ${(phase === "preview" || phase === "confirming" || phase === "success") ? "opacity-100 border-white/[0.08]" : "opacity-0 border-transparent pointer-events-none"}`}>

        {/* Success — matches real UI: SWAP SUCCESSFUL + on-chain risk badge */}
        {phase === "success" && (
          <div className="flex flex-col items-center gap-3 animate-fade-in-up" style={{ minHeight: 380 }}>
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-polkadot-green/20">
                <svg className="h-4.5 w-4.5 text-polkadot-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm font-semibold uppercase tracking-widest text-polkadot-green/80">Swap Successful</p>
            </div>

            {/* Swap amounts box */}
            <div className="w-full rounded-xl bg-white/[0.04] border border-white/[0.06] p-5">
              <div className="text-center space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Sent</p>
                <p className="text-xl font-bold text-white">100 <span className="text-base text-white/50">DOT</span></p>
              </div>
              <div className="my-2.5 flex justify-center">
                <svg className="h-4 w-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              <div className="text-center space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Received</p>
                <p className="text-xl font-bold text-polkadot-green">685.42 <span className="text-base text-polkadot-green/50">USDT</span></p>
              </div>
            </div>

            {/* On-chain risk badge — GREEN */}
            <div className="w-full rounded-xl border border-polkadot-green/20 bg-polkadot-green/[0.06] p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-polkadot-green" />
                  <span className="text-sm font-semibold text-polkadot-green">GREEN</span>
                  <span className="text-xs text-white/30">Score 4/100</span>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-white/25">On-chain verified</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-white/30">
                <span>Impact: 0.31%</span>
                <span>Vol: 1.00%</span>
              </div>
            </div>

            {/* TX hash */}
            <div className="flex items-center justify-between w-full text-xs text-white/25 px-1">
              <span>Transaction</span>
              <span className="font-mono text-polkadot-cyan/70">0x7a3f...b82d</span>
            </div>
          </div>
        )}

        {/* Confirming state — on-chain verification */}
        {phase === "confirming" && (
          <div className="flex flex-col items-center justify-center gap-3 animate-fade-in-up" style={{ minHeight: 380 }}>
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-2 border-white/10" />
              <div className="absolute inset-0 rounded-full border-2 border-t-polkadot-green border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            </div>
            <p className="text-sm font-medium text-white/80">On-chain verification...</p>
            <p className="text-xs text-white/30">Risk Engine (Rust/PolkaVM) validating swap</p>
          </div>
        )}

        {/* Preview content — hidden during confirming/success */}
        {phase === "preview" && (
          <>
            {/* Header with timer */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Transaction Preview</p>
              <div className="flex items-center gap-1">
                <svg className="h-5 w-5 -rotate-90" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/[0.06]" />
                  <circle cx="12" cy="12" r="10" fill="none" strokeWidth="2" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="text-white/20" style={{ transition: "stroke-dashoffset 1s linear" }} />
                </svg>
                <span className="text-[11px] font-mono tabular-nums text-white/30">{timerValue}s</span>
              </div>
            </div>

            {/* Swap summary */}
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
              <div className="text-center space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">You send</p>
                <p className="text-2xl font-bold text-white">100 <span className="text-lg text-white/60">DOT</span></p>
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
                <p className="text-2xl font-bold text-polkadot-green">685.42 <span className="text-lg text-polkadot-green/60">USDT</span></p>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-2 px-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Slippage</span>
                <span className="text-white/60">0.31%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Price Impact</span>
                <span className="text-white/60">0.01%</span>
              </div>
            </div>

            {/* Risk badge */}
            <div className="rounded-xl border border-risk-green/30 bg-risk-green/10 px-4 py-3 text-center text-sm font-semibold text-risk-green">
              ✅ LOW RISK
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <div className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-center text-sm text-white/40">Cancel</div>
              <div className={`flex-1 rounded-xl py-2.5 text-center text-sm font-semibold text-white shadow-lg transition-all duration-200 ${confirmClicked ? "bg-polkadot-pink/60 scale-95 shadow-none" : "bg-polkadot-pink shadow-polkadot-pink/20"}`}>
                Confirm Swap
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

/* ── Main Page Component ────────────────────────────────── */
export default function Home() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const scrollRef = useScrollAnimation(mounted);
  useEffect(() => setMounted(true), []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.06] px-6 py-4 glass">
        <div className="flex items-center gap-3">
          <button onClick={scrollToTop} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Intent<span className="text-polkadot-pink">DOT</span>
            </h1>
            <span className="rounded-full border border-polkadot-pink/20 bg-polkadot-pink/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-polkadot-pink">
              AI DeFi
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {mounted && isConnected && (
            <Link
              href="/chat"
              className="rounded-xl border border-polkadot-pink/30 bg-polkadot-pink/10 px-4 py-2.5 text-sm font-semibold text-polkadot-pink hover:bg-polkadot-pink/20 transition-all"
            >
              Open Chat
            </Link>
          )}
          <ConnectWallet />
        </div>
      </header>

      {/* Landing page — always visible */}
      {mounted && (
        <div ref={scrollRef} className="relative z-10">

          {/* ── Section 1: Hero ────────────────────────────── */}
          <section className="relative flex min-h-[100vh] flex-col items-center justify-center overflow-hidden px-6 pt-16 pb-24">
            {/* Floating decorative orbs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-float absolute -left-32 top-1/4 h-64 w-64 rounded-full bg-polkadot-pink/10 blur-3xl" />
              <div className="animate-float absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-polkadot-purple/10 blur-3xl" style={{ animationDelay: "2s" }} />
              <div className="animate-float absolute bottom-1/4 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-polkadot-cyan/8 blur-3xl" style={{ animationDelay: "4s" }} />
            </div>

            <div className="relative flex max-w-4xl flex-col items-center text-center">
              {/* Testnet badge */}
              <div className="animate-fade-in-up mb-8 flex items-center gap-2 rounded-full border border-polkadot-green/20 bg-polkadot-green/5 px-4 py-1.5">
                <span className="h-2 w-2 rounded-full bg-polkadot-green animate-pulse" />
                <span className="text-xs font-medium text-polkadot-green">Live on Polkadot Hub TestNet</span>
              </div>

              {/* Heading */}
              <h2 className="animate-fade-in-up mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-7xl" style={{ animationDelay: "0.1s" }}>
                DeFi in Plain English.
                <br />
                <span className="gradient-text">Secured by AI.</span>
              </h2>

              {/* Subheading */}
              <p className="animate-fade-in-up mb-10 max-w-xl text-base text-white/40 leading-relaxed sm:text-lg" style={{ animationDelay: "0.2s" }}>
                Type what you want in natural language. Our AI Risk Guardian evaluates every transaction before you confirm. Built on Polkadot.
              </p>

              {/* CTA */}
              <div className="animate-fade-in-up mb-16" style={{ animationDelay: "0.3s" }}>
                {isConnected ? (
                  <Link
                    href="/chat"
                    className="inline-flex items-center gap-2 rounded-xl bg-polkadot-pink px-8 py-3 text-base font-semibold text-white hover:bg-polkadot-pink/80 transition-all hover:shadow-lg hover:shadow-polkadot-pink/20 active:scale-[0.98]"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                    Start Chatting
                  </Link>
                ) : (
                  <ConnectWallet />
                )}
              </div>

              {/* Animated demo */}
              <AnimatedDemo />
            </div>

          </section>

          {/* ── Section 2: Features ───────────────────────── */}
          <section className="px-6 py-24">
            <div className="mx-auto max-w-5xl">
              <h3 className="animate-on-scroll mb-4 text-center text-sm font-semibold uppercase tracking-widest text-polkadot-pink">
                Features
              </h3>
              <p className="animate-on-scroll mb-16 text-center text-3xl font-bold text-white sm:text-4xl">
                Everything you need for<br className="hidden sm:block" /> intent-based DeFi
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((f, i) => (
                  <div
                    key={f.title}
                    className={`animate-on-scroll group rounded-2xl border ${f.borderColor} bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04] hover:border-white/10`}
                    style={{ transitionDelay: `${(i + 1) * 100}ms` }}
                  >
                    <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${f.bgColor} ${f.textColor}`}>
                      <FeatureIcon name={f.icon} />
                    </div>
                    <h4 className="mb-2 text-base font-semibold text-white">{f.title}</h4>
                    <p className="text-sm leading-relaxed text-white/40">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Section 3: How It Works ───────────────────── */}
          <section className="px-6 py-24">
            <div className="mx-auto max-w-4xl">
              <h3 className="animate-on-scroll mb-4 text-center text-sm font-semibold uppercase tracking-widest text-polkadot-cyan">
                How It Works
              </h3>
              <p className="animate-on-scroll mb-16 text-center text-3xl font-bold text-white sm:text-4xl">
                Three steps to safe DeFi
              </p>
              <div className="relative grid gap-8 sm:grid-cols-3">
                {/* Connecting line (hidden on mobile) */}
                <div className="pointer-events-none absolute top-12 left-[16.67%] right-[16.67%] hidden border-t-2 border-dashed border-white/10 sm:block" />
                {steps.map((s, i) => (
                  <div key={s.num} className="animate-on-scroll relative flex flex-col items-center text-center" style={{ transitionDelay: `${(i + 1) * 100}ms` }}>
                    <div className="relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                      <span className="text-2xl font-bold gradient-text">{s.num}</span>
                    </div>
                    <h4 className="mb-2 text-base font-semibold text-white">{s.title}</h4>
                    <p className="text-sm leading-relaxed text-white/40">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Section 4: Roadmap ────────────────────────── */}
          <section className="px-6 py-24">
            <div className="mx-auto max-w-5xl">
              <h3 className="animate-on-scroll mb-4 text-center text-sm font-semibold uppercase tracking-widest text-polkadot-purple">
                Roadmap
              </h3>
              <p className="animate-on-scroll mb-4 text-center text-3xl font-bold text-white sm:text-4xl">
                What&apos;s next for IntentDOT
              </p>
              <div className="animate-on-scroll mb-12 flex items-center justify-center gap-5 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[#E6007A]" />
                  <span className="text-[#E6007A]">EVM</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[#DEA584]" />
                  <span className="text-[#DEA584]">PVM</span>
                </span>
              </div>
              <div className="grid gap-6 sm:grid-cols-3">
                {roadmapPhases.map((phase, pi) => (
                  <div key={phase.phase} className="animate-on-scroll" style={{ transitionDelay: `${(pi + 1) * 100}ms` }}>
                    <div className="mb-4 flex items-center gap-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${phase.badgeColor}`}>
                        {phase.phase}
                      </span>
                      <span className="text-sm text-white/30">{phase.label}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {phase.items.map((item) => (
                        <RoadmapItem key={item.text} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Section 5: CTA ────────────────────────────── */}
          <section className="px-6 py-24">
            <div className="mx-auto max-w-2xl">
              <div className="animate-on-scroll animate-pulse-glow rounded-2xl border border-white/[0.08] glass p-10 text-center sm:p-14">
                <h3 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
                  Ready to try intent-based DeFi?
                </h3>
                <p className="mb-8 text-sm text-white/40 leading-relaxed">
                  Connect your wallet and start trading with natural language on Polkadot Hub TestNet.
                </p>
                {isConnected ? (
                  <Link
                    href="/chat"
                    className="inline-flex items-center gap-2 rounded-xl bg-polkadot-pink px-8 py-3 text-base font-semibold text-white hover:bg-polkadot-pink/80 transition-all hover:shadow-lg hover:shadow-polkadot-pink/20 active:scale-[0.98]"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                    Start Chatting
                  </Link>
                ) : (
                  <ConnectWallet />
                )}
              </div>
            </div>
          </section>

          {/* ── Footer ────────────────────────────────────── */}
          <footer className="border-t border-white/[0.04] px-6 py-8">
            <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-white">
                  Intent<span className="text-polkadot-pink">DOT</span>
                </span>
                <span className="text-xs text-white/20">AI-powered DeFi Intent Solver</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs text-white/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-polkadot-green" />
                  Built on Polkadot Hub TestNet
                </span>
                <a
                  href="https://github.com/PavelMal/IntentDOT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/20 hover:text-white/40 transition-colors"
                >
                  GitHub
                </a>
              </div>
            </div>
          </footer>
        </div>
      )}
    </main>
  );
}
