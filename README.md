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
- **On-Chain Transaction History** — All swaps and transfers pulled directly from blockchain events (no backend)
- **Live Portfolio & Pool Data** — Token balances and pool prices/reserves in header, auto-refreshing
- **Quick Actions** — One-click chips for common intents (swap, bridge, balance, create token)
- **XCM Cross-Chain Teleport** — "Bridge 20 PAS to relay chain" — teleport native PAS to Paseo Relay Chain via XCM precompile. Uses burn/mint between trusted system chains (Hub ↔ Relay)
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
- Foundry nightly (`curl -L https://foundry.paradigm.xyz | bash && foundryup --install nightly`)
- MetaMask browser extension

### 1. Install & Configure

```bash
git clone https://github.com/PavelMal/IntentDOT.git
cd IntentDOT

# Install frontend
cd frontend
npm install

# Configure environment
cp ../.env.example .env.local
# Edit .env.local — set your AI key (one of):
#   ANTHROPIC_API_KEY=sk-ant-...
#   OPENAI_API_KEY=sk-...
```

### 2. Add MetaMask Network

Add Polkadot Hub TestNet to MetaMask manually:

| Setting | Value |
|---------|-------|
| RPC URL | `https://eth-rpc-testnet.polkadot.io/` |
| Chain ID | `420420417` |
| Symbol | `PAS` |
| Explorer | `https://blockscout-testnet.polkadot.io` |

Get testnet tokens: [faucet.polkadot.io](https://faucet.polkadot.io/) → Polkadot testnet (Paseo) → Hub (smart contracts)

### 3. Run

```bash
# Start dev server (from frontend/)
npm run dev
# Open http://localhost:3000
```

The app connects to already deployed contracts on Polkadot Hub TestNet — no local deployment needed.

### 4. Run Tests

```bash
# Contract tests (38 tests)
cd contracts
forge install
forge test -vvv

# Frontend tests (185 tests)
cd frontend
npm test
```

### Deploy Your Own Contracts (optional)

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://eth-rpc-testnet.polkadot.io/ \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast --legacy

# Then update frontend/.env.local with new contract addresses
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
| RiskEngine (PVM Rust) | `0x20c0dF8e93A0c400b7b36f699101972712ad7f9F` |

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

### v1 — Now

| Track | Feature | Description |
|-------|---------|-------------|
| EVM | **Natural Language Intents** | Type "Swap 10 DOT to USDT" — AI parses and builds the transaction |
| EVM | **AI Risk Guardian** | Off-chain pre-check: scores slippage, liquidity, pool drain before confirm |
| EVM | **Token Swaps & Transfers** | Swap and send tokens via natural language |
| EVM | **Token Factory** | Deploy ERC-20 tokens from chat, auto-whitelist on DEX |
| EVM | **Portfolio & History** | Live token balances + full transaction log from blockchain events |
| PVM | **Rust Risk Engine** | On-chain risk scoring (price impact, MA20, volatility). RED = auto revert |
| PVM | **XCM Cross-Chain Bridge** | Teleport tokens between Polkadot chains via XCM Precompile |

### v2 — Next

| Track | Feature | Description |
|-------|---------|-------------|
| EVM | **EIP-7702 Smooth Mode** | Zero-popup trading — sign once, trade forever |
| EVM | **NFT Trading** | Buy/sell NFTs with natural language intents |
| EVM | **People Chain Identity** | Send tokens by name — resolve via Polkadot People Chain |
| PVM | **Multi-Pool Correlation** | Detect manipulation by comparing price moves across pools |
| PVM | **Oracle Price Feeds** | Compare pool price with external oracle (Chainlink/DIA) |
| PVM | **Dynamic Risk Thresholds** | Adaptive scoring — stricter for new pools, lenient for mature ones |

### v3 — Future

| Track | Feature | Description |
|-------|---------|-------------|
| EVM | **AI Trading Strategies** | Describe strategy in plain English, AI executes on schedule |
| EVM | **Liquidity Provision** | Add liquidity via natural language with impermanent loss warnings |
| EVM | **DEX Aggregation** | Route swaps across multiple DEXes for best price |
| PVM | **MEV Protection On-Chain** | Detect frontrunning and sandwich attacks at contract level |
| PVM | **Cross-Chain Risk via XCM** | Risk-as-a-service — other parachains use our Risk Engine via XCM |
| PVM | **Governance Risk Parameters** | Community votes to adjust risk thresholds without redeploying |

## Hackathon

Built for **Polkadot Solidity Hackathon 2026** (EVM Smart Contracts + PVM Smart Contracts tracks).

## Tests

- **Contracts:** 38 Foundry tests — swap (9), whitelist (5), transfer (4), factory (7), risk engine (12), events
- **Frontend:** 185 Jest tests — intent validation (47), risk scoring (22), preview builder (25), risk display (28), XCM encoder (15), bridge flow (12), integration (12), E2E testnet (24)
- **Total:** 223 tests (38 contract + 185 frontend/E2E)
- Run: `cd contracts && forge test -vvv` / `cd frontend && npm test`

## License

MIT
