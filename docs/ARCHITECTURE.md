# Architecture — IntentDOT

## System Overview

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Chat UI    │────→│  AI Intent   │────→│  Risk Guardian  │
│  (Next.js)   │     │   Parser     │     │   (Scoring)     │
│  + Wallet    │     │  (LLM API)   │     │                 │
└──────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │   TX Preview    │
                                          │  + Confirm UI   │
                                          └────────┬────────┘
                                                   │ user confirms
                                          ┌────────▼────────┐
                                          │ IntentExecutor   │──→ Token Whitelist
                                          │    .sol          │
                                          │ (Polkadot Hub)   │
                                          └───┬─────┬───┬───┘
                                              │     │   │
                                  ┌───────────┘     │   └──────────┐
                                  ▼                 ▼              ▼
                          ┌──────────────┐  ┌────────────┐  ┌──────────────┐
                          │ MockDEX.sol  │  │  Direct    │  │TokenFactory  │
                          │ (AMM Pool)   │  │  Transfer  │  │   .sol       │
                          └──────┬───────┘  └────────────┘  └──────────────┘
                                 │
                          ┌──────▼───────┐
                          │ RiskEngine   │ ← Rust PVM contract
                          │  (PolkaVM)   │   on-chain risk scoring
                          └──────────────┘
```

### Intent Types
- **swap** → IntentExecutor → RiskEngine (PVM) → MockDEX (Uniswap V2 AMM)
- **transfer** → IntentExecutor → ERC20 transferFrom (direct)
- **create_token** → TokenFactory → deploy new ERC20 + mint + auto-whitelist

## Components

### Chat UI
- **Responsibility:** User interface — wallet connect, chat input, tx preview, result display
- **Tech:** Next.js 14, Tailwind CSS, wagmi v2, viem
- **Files:** `src/components/Chat.tsx`, `src/components/TransactionPreview.tsx`, `src/components/SwapReceipt.tsx`, `src/components/TransferPreview.tsx`, `src/components/TransferReceipt.tsx`, `src/components/TokenCreatePreview.tsx`, `src/components/TokenCreateReceipt.tsx`, `src/components/ConnectWallet.tsx`
- **Input:** User natural language text, wallet connection
- **Output:** Parsed intent display, risk score badge (GREEN/YELLOW/RED), tx receipt with explorer link

### AI Intent Parser
- **Responsibility:** Parse natural language into structured DeFi intents (swap, transfer, create_token)
- **Tech:** Anthropic Claude / OpenAI GPT-4o (structured JSON output)
- **Files:** `src/app/api/parse-intent/route.ts`, `src/lib/intent-validator.ts`
- **Input:** Raw user text string (validated: non-empty, ≤500 chars)
- **Output:** `{ success: true, intent: { action, token_from, token_to, amount, recipient?, tokenName?, tokenSymbol?, initialSupply? } }` or `{ success: false, clarification: string }`

### Risk Guardian
- **Responsibility:** Score transaction risk before execution
- **Tech:** Pure TypeScript module with Uniswap V2 math (bigint)
- **Files:** `src/lib/risk-guardian.ts`, `src/lib/preview-builder.ts`
- **Input:** Amount (bigint) + pool state (reserveIn, reserveOut)
- **Output:** `{ level: "GREEN"|"YELLOW"|"RED", slippage: number, priceImpact: number, reasons: string[] }`
- **Thresholds:** Slippage >3%=YELLOW >10%=RED, Liquidity <1000=YELLOW <100=RED, Drain >10%=YELLOW >30%=RED

### Preview Builder
- **Responsibility:** Combine intent + risk assessment into TransactionPreview for UI
- **Files:** `src/lib/preview-builder.ts`
- **Input:** Parsed intent + optional on-chain pool state (falls back to seeded stubs)
- **Output:** `TransactionPreview { intent, amountOut, risk, tokenInAddress, tokenOutAddress }`

### Execution Hooks (Frontend)
- **Responsibility:** Handle approve → execute flows via wagmi/viem
- **Files:** `src/hooks/useSwapExecution.ts`, `src/hooks/useTransferExecution.ts`, `src/hooks/useTokenCreation.ts`, `src/lib/abis.ts`, `src/lib/risk-display.ts`
- **Swap Flow:** Check balance → check/set allowance → call IntentExecutor.executeSwap → wait for receipt → parse RiskChecked event → show on-chain risk badge
- **Transfer Flow:** Check balance → approve → IntentExecutor.executeTransfer → receipt
- **Create Flow:** Call TokenFactory.createToken → parse TokenCreated event → receipt
- **States:** idle → approving → approved → executing → success/error
- **Two-Layer Risk:** AI Risk Guardian (off-chain preview, soft warning) + Rust Risk Engine (on-chain enforcement, hard block)

### IntentExecutor.sol
- **Responsibility:** On-chain entry point — receives structured intents, routes to DEX or direct transfer
- **Tech:** Solidity 0.8.19, Foundry, reentrancy guard, token whitelist
- **Functions:** executeSwap, executeTransfer, previewSwap, whitelistToken, setFactory, setRiskEngine
- **Risk Check:** Before every swap, calls RiskEngine.evaluate() — RED risk (score ≥70) reverts the transaction
- **Events:** IntentExecuted, TokenWhitelisted, RiskChecked, RiskEngineUpdated
- **Security:** onlyWhitelisted modifier on all token operations, onlyOwner/factory for whitelist management

### RiskEngine (Rust PVM Contract)
- **Responsibility:** On-chain risk scoring — price impact, MA20 deviation, volatility
- **Tech:** Rust no_std, compiled to PolkaVM RISC-V bytecode via polkavm 0.26.0
- **Functions:** evaluate(amountIn, reserveIn, reserveOut, tokenIn, tokenOut) → (riskLevel, score, priceImpact, volatility), getStats(tokenIn, tokenOut) → (ma20, volatility, tradeCount)
- **Storage:** Per-pool ring buffer of 20 price entries, indexed by deterministic pool_id (XOR+mix of sorted token addresses)
- **Risk Levels:** 0=GREEN (safe), 1=YELLOW (elevated), 2=RED (blocked)
- **Scoring:** Composite of price impact (40%), MA20 deviation (30%), volatility (30%)

### MockDEX.sol
- **Responsibility:** Uniswap V2 style AMM — constant product pools for demo
- **Tech:** Solidity 0.8.19, Foundry
- **Input:** Token pair + amounts
- **Output:** Swapped tokens, updated reserves

### TokenFactory.sol
- **Responsibility:** Deploy new ERC20 tokens, mint to creator, auto-whitelist in IntentExecutor
- **Tech:** Solidity 0.8.19, Foundry
- **Functions:** createToken(name, symbol, initialSupply), getTokensByCreator
- **Events:** TokenCreated(creator, tokenAddress, name, symbol, initialSupply)

## Data Flow

1. User types intent in chat → frontend sends text to AI Parser (API route)
2. AI Parser returns structured intent JSON (or asks for clarification)
3. Frontend reads pool state from MockDEX contract → passes to Risk Guardian
4. Risk Guardian calculates slippage + liquidity score → returns risk level (AI gate)
5. Frontend shows TX Preview (amounts + risk) → user confirms or cancels
6. On confirm: frontend calls IntentExecutor.executeSwap() via wagmi
7. IntentExecutor calls RiskEngine.evaluate() (Rust PVM) → RED = revert (on-chain gate)
8. If GREEN/YELLOW: IntentExecutor routes to MockDEX.swap() → tokens transferred
9. Frontend parses RiskChecked event from receipt → displays on-chain risk badge

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14 + Tailwind CSS | Fast setup, SSR, hackathon standard |
| Wallet | wagmi v2 + viem + MetaMask | EVM standard, Polkadot Hub compatible |
| AI | Anthropic Claude / OpenAI GPT-4o | Best structured output, dual-provider support |
| Contracts | Solidity 0.8.19 + Foundry (nightly) | Polkadot Hub compatible, fast compile/test |
| PVM | Rust no_std + polkavm 0.26.0 + polkatool | Native PolkaVM RISC-V contract on Polkadot |
| Network | Polkadot Hub TestNet (chain 420420417) | Official Polkadot testnet, PAS tokens |
| Deploy | Vercel (frontend) + Foundry (contracts) | Zero-config deploy |

## Key Decisions

| Decision | Options Considered | Chosen | Why |
|----------|-------------------|--------|-----|
| AI Provider | OpenAI, Anthropic, local LLM | Anthropic Claude (primary) + OpenAI fallback | Both supported, Anthropic priority for quality |
| DEX | Use existing testnet DEX, deploy mock | Mock DEX | No reliable DEX on testnet yet, full control for demo |
| Risk scoring | ML model, rule-based, hybrid | Two-layer: Rule-based (AI) + On-chain (Rust) | AI gate for preview + Rust PVM for hard enforcement |
| Frontend framework | Next.js, Vite+React, Scaffold-ETH | Next.js | Familiar, fast, easy Vercel deploy |
| Contract framework | Hardhat, Foundry | Foundry | Faster compilation, better testing, lighter |

## Constraints

- **Time:** ~14 days to submission (Mar 20 deadline)
- **Network:** Polkadot Hub TestNet testnet — may have instability
- **No real liquidity:** MockDEX with pre-seeded pools
- **AI cost:** Anthropic/OpenAI API calls — budget ~$10-20 for hackathon
- **PVM toolchain:** polkavm 0.26.0 + polkatool 0.26.0 must match testnet runtime
