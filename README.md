# IntentDOT

> AI-powered DeFi Intent Solver for Polkadot Hub

**Say what you want. Get it done safely.**

<p align="center">
  <img src="frontend/public/demo.svg" alt="IntentDOT Demo — type intent, preview, confirm, execute" width="480"/>
</p>

IntentDOT lets you execute DeFi operations on Polkadot by simply typing what you want in natural language. An AI agent parses your intent, evaluates risks, and executes the optimal transaction — all in one interface.

## Features

- **Natural Language DeFi** — Type "Swap 10 DOT to USDT" instead of navigating complex DEX UIs
- **On-Chain Risk Engine (Rust/PolkaVM)** — Every swap validated by a Rust smart contract running natively on Polkadot. RED risk = transaction reverted automatically. [Details below](#on-chain-risk-engine)
- **AI Risk Guardian** — Off-chain pre-check: scores slippage, liquidity, and pool drain before you confirm
- **Token Transfers** — "Send 50 USDT to 0x..." — direct token transfers via intent
- **Token Factory** — "Create a token called PEPE with 1M supply" — deploy ERC20s from chat
- **On-Chain Whitelist** — Only verified tokens can be swapped/transferred (security layer)
- **Quote Expiry Timer** — 30s countdown on previews, auto-refresh with live pool data
- **One-Click Execution** — Preview exact amounts + risk, confirm, done
- **XCM Cross-Chain Bridge** — "Bridge 20 PAS to relay chain" — teleport native PAS via XCM precompile
- **Polkadot Hub Native** — Solidity + Rust contracts on Polkadot Hub EVM & PolkaVM

## Architecture

```
User: "Swap 10 DOT to USDT"
         │
         ▼
    ┌─────────┐     ┌──────────────┐     ┌─────────────┐
    │ Chat UI │────→│  AI Parser   │────→│Risk Guardian│ ← off-chain (AI)
    └─────────┘     └──────────────┘     └──────┬──────┘
                                                │ user confirms
                                         ┌──────▼──────┐
                                         │   Intent    │
                                         │  Executor   │ (Solidity)
                                         └──────┬──────┘
                                                │
                                         ┌──────▼──────┐
                                         │ Risk Engine │ ← on-chain (Rust/PolkaVM)
                                         │  evaluate() │   RED → revert
                                         └──────┬──────┘
                                                │ GREEN/YELLOW
                                         ┌──────▼──────┐
                                         │  MockDEX    │ → swap executed
                                         └─────────────┘
```


## Quick Start

### Prerequisites

- Node.js 20+
- Foundry nightly
- MetaMask

### Setup

```bash
# Install frontend
cd frontend && npm install

# Configure
cp .env.example .env.local
# Required (set ONE): ANTHROPIC_API_KEY=sk-ant-... or OPENAI_API_KEY=sk-...
# Optional (for on-chain): NEXT_PUBLIC_INTENT_EXECUTOR, NEXT_PUBLIC_MOCK_DEX,
#   NEXT_PUBLIC_DOT_TOKEN, NEXT_PUBLIC_USDT_TOKEN, NEXT_PUBLIC_USDC_TOKEN,
#   NEXT_PUBLIC_TOKEN_FACTORY

# Install contract dependencies
cd ../contracts && forge install

# Compile contracts
forge build

# Run tests
forge test -vvv             # 37 contract tests
cd ../frontend && npm test  # 141 frontend + E2E tests

# Start dev server
cd frontend && npm run dev
```

### Deploy to Testnet

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://eth-rpc-testnet.polkadot.io/ \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast --legacy
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, Tailwind CSS, wagmi v2, [w3wallets](https://github.com/Maksandre/w3wallets) + Playwright (E2E) |
| AI | Anthropic Claude / OpenAI GPT-4o (structured output) |
| Contracts | Solidity 0.8.19, Foundry (nightly) |
| PVM | Rust `no_std` + polkavm 0.26.0 → PolkaVM RISC-V bytecode |
| Network | Polkadot Hub TestNet (chain 420420417) |

## On-Chain Risk Engine

### Why on-chain validation?

Off-chain risk checks (like our AI Risk Guardian) can be bypassed — a user can call the contract directly, skip the frontend, or a bot can submit swaps with no UI at all. The only way to **guarantee** every swap is safe is to enforce risk limits **inside the smart contract itself**.

That's what the Risk Engine does. It's a Rust smart contract compiled to [PolkaVM](https://wiki.polkadot.network/docs/learn-polkavm) (Polkadot's native RISC-V virtual machine) and called by `IntentExecutor` before every swap. If risk is RED, the transaction reverts — no tokens move, no matter who submitted it.

### How it works

```
IntentExecutor.executeSwap()
  │
  ├─ 1. Read pool reserves from MockDEX
  ├─ 2. Call RiskEngine.evaluate(amountIn, reserveIn, reserveOut, tokenIn, tokenOut)
  │       │
  │       ├─ Calculate price impact (how much the trade moves the price)
  │       ├─ Compare current price to 20-trade moving average (MA20)
  │       ├─ Measure historical volatility (standard deviation)
  │       ├─ Composite score = 40% impact + 30% MA20 deviation + 30% volatility
  │       │
  │       └─ Return: riskLevel (GREEN/YELLOW/RED), score, priceImpact, volatility
  │
  ├─ 3. If RED → revert("risk too high") — swap blocked
  ├─ 4. If GREEN/YELLOW → proceed with swap
  └─ 5. Emit RiskChecked event (parsed by frontend for risk badge)
```

### Two-layer protection

| Layer | Where | Purpose | Enforcement |
|-------|-------|---------|-------------|
| **AI Risk Guardian** | Frontend (off-chain) | Pre-swap preview: scores slippage, liquidity, pool drain | UI blocks RED swaps (Confirm disabled), but can be bypassed by calling the contract directly |
| **Rust Risk Engine** | PolkaVM (on-chain) | Per-swap validation: price impact, MA20, volatility | Contract-level — transaction reverts on RED, cannot be bypassed by anyone |

### Per-pool tracking

Each pool (e.g. DOT/USDT, DOT/USDC) has its own price history stored in contract storage — a ring buffer of 20 recent prices. Pools can't contaminate each other's data. The pool identity is derived deterministically from sorted token addresses.

### Tech

- **Language:** Rust (`no_std`, `no_main`) — compiled to RISC-V via `polkavm 0.26.0`
- **Size:** ~6 KB `.polkavm` blob deployed on Polkadot Hub TestNet
- **Interface:** Standard Solidity ABI — `evaluate()` and `getStats()` callable from any EVM contract
- **Storage:** Per-pool ring buffer (20 slots), index, trade count — all keyed by pool ID

## Smart Contracts

| Contract | Description |
|----------|-------------|
| **IntentExecutor** | Entry point: executeSwap, executeTransfer, token whitelist, risk check |
| **RiskEngine** | Rust/PolkaVM: on-chain risk scoring (price impact, MA20, volatility) |
| **MockDEX** | Uniswap V2 AMM: addLiquidity, swap, getAmountOut |
| **MockERC20** | Simple ERC20 with mint (testnet only) |
| **TokenFactory** | Deploy new ERC20 tokens, auto-whitelist, mint to creator |

## Deployed Contracts (Polkadot Hub TestNet)

| Contract | Address |
|----------|---------|
| DOT Token | `0x0Fb72340AA780c00823E0a80429327af63E8d2Fc` |
| USDT Token | `0x12e41FDB22Bc661719B4D7445952e1b51C429dDB` |
| USDC Token | `0x540De5E6237395b63cFd9C383C47F5F32FAb3123` |
| MockDEX | `0x5b2810428f3DA3400f111f516560EE63d44c336A` |
| IntentExecutor V3 | `0xdD44bd254dD0bBB6Bfe7C7C062aDA4150e1546d7` |
| TokenFactory | `0x1Ba4FDBab1C786Bd0aE8c4105711b90dDf87FCDD` |
| RiskEngine (PVM Rust) | `0xEE6deEd91F29143521a4443553479A5fB97BdfA7` |

**Network:** Polkadot Hub TestNet (Paseo)
- Chain ID: `420420417`
- RPC: `https://eth-rpc-testnet.polkadot.io/`
- Symbol: `PAS`
- Explorer: [Blockscout TestNet](https://blockscout-testnet.polkadot.io)
- Faucet: [faucet.polkadot.io](https://faucet.polkadot.io/) → Polkadot testnet (Paseo) → Hub (smart contracts)

**Seeded Pools:**
- DOT/USDT — 50,000 DOT / 337,500 USDT (1 DOT = 6.75 USDT)
- DOT/USDC — 50,000 DOT / 337,500 USDC

## Roadmap

| Phase | Feature | Description |
|-------|---------|-------------|
| v2 | **EIP-7702 Smooth Mode** | Zero-popup trading — sign once, trade forever. Waiting for Polkadot Hub support |
| v2 | **NFT Trading** | Buy/sell NFTs with natural language intents |
| v2 | **People Chain Identity** | "Send 10 USDC to Alice" — resolve name via Polkadot People Chain |
| v2 | **XCM Cross-Chain Assets** | Bridge any pallet_assets token between parachains via XCM intents |
| v3 | **AI Trading Strategies** | DCA, stop-loss, scheduled execution |
| v3 | **DEX Aggregation** | Route swaps through best available pool |

## Hackathon

Built for **Polkadot Solidity Hackathon 2026** (EVM Smart Contracts + PVM Smart Contracts tracks).

## Tests

- **Contracts:** 37 Foundry tests — swap (9), whitelist (5), transfer (4), factory (7), risk engine (11), events
- **Frontend:** 150 Jest tests — intent validation (47), risk scoring (22), preview builder (25), risk display (28), XCM encoder (13), integration (12), E2E testnet (21)
- **Total:** 187 tests (37 contract + 150 frontend/E2E)
- Run: `cd contracts && forge test -vvv` / `cd frontend && npm test`

## License

MIT
