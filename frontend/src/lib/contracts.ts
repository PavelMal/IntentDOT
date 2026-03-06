import { type Address } from "viem";

export const CONTRACTS = {
  intentExecutor: (process.env.NEXT_PUBLIC_INTENT_EXECUTOR ||
    "0x0000000000000000000000000000000000000000") as Address,
  mockDex: (process.env.NEXT_PUBLIC_MOCK_DEX ||
    "0x0000000000000000000000000000000000000000") as Address,
  dotToken: (process.env.NEXT_PUBLIC_DOT_TOKEN ||
    "0x0000000000000000000000000000000000000000") as Address,
  usdtToken: (process.env.NEXT_PUBLIC_USDT_TOKEN ||
    "0x0000000000000000000000000000000000000000") as Address,
  usdcToken: (process.env.NEXT_PUBLIC_USDC_TOKEN ||
    "0x0000000000000000000000000000000000000000") as Address,
  tokenFactory: (process.env.NEXT_PUBLIC_TOKEN_FACTORY ||
    "0x0000000000000000000000000000000000000000") as Address,
} as const;

export const TOKEN_MAP: Record<string, { address: Address; decimals: number; symbol: string }> = {
  DOT: { address: CONTRACTS.dotToken, decimals: 18, symbol: "DOT" },
  USDT: { address: CONTRACTS.usdtToken, decimals: 18, symbol: "USDT" },
  USDC: { address: CONTRACTS.usdcToken, decimals: 18, symbol: "USDC" },
};
