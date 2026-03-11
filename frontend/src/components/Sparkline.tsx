"use client";

import { createPortal } from "react-dom";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  onClick?: () => void;
}

export function Sparkline({ data, width = 100, height = 24, color = "#E6007A", onClick }: SparklineProps) {
  if (data.length < 2) return null;

  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <span className={`inline-flex items-center gap-1 ${onClick ? "cursor-pointer group" : ""}`} onClick={onClick}>
      <svg width={width} height={height} className="inline-block">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {onClick && (
        <svg className="h-3 w-3 text-white/20 group-hover:text-white/40 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m10.5-6v4.5m0-4.5h-4.5m4.5 0L15 9m-10.5 6v4.5m0-4.5h4.5m-4.5 4.5L9 15m10.5 6v-4.5m0 4.5h-4.5m4.5 0L15 15" />
        </svg>
      )}
    </span>
  );
}

interface PriceChartModalProps {
  poolName: string;
  quote: string;
  prices: number[];
  currentPrice: string;
  onClose: () => void;
}

export function PriceChartModal({ poolName, quote, prices, currentPrice, onClose }: PriceChartModalProps) {
  const w = 320;
  const h = 160;
  const pad = 20;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const coords = prices.map((v, i) => ({
    x: pad + (i / (prices.length - 1)) * (w - pad * 2),
    y: pad + (1 - (v - min) / range) * (h - pad * 2),
    price: v,
  }));

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPoints = `${coords[0].x},${h - pad} ${polyline} ${coords[coords.length - 1].x},${h - pad}`;

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-[380px] rounded-2xl border border-white/[0.08] bg-[#1a1425] shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <div className="text-sm font-medium text-white/70">{poolName}</div>
            <div className="text-xs text-white/35">
              1 DOT <span className="text-polkadot-pink font-mono">≈ {currentPrice} {quote}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none">&times;</button>
        </div>

        {/* Chart */}
        <div className="px-5 py-3">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id={`grad-${poolName}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E6007A" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#E6007A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#grad-${poolName})`} />
            <polyline
              points={polyline}
              fill="none"
              stroke="#E6007A"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {coords.map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r={3} fill="#1a1425" stroke="#E6007A" strokeWidth={1.5} />
            ))}
          </svg>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between px-5 pb-4 text-[11px] text-white/30">
          <span>Low: <span className="text-white/50 font-mono">{min.toFixed(2)}</span></span>
          <span>High: <span className="text-white/50 font-mono">{max.toFixed(2)}</span></span>
          <span>{prices.length} trades</span>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
