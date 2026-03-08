# IntentDOT

> AI-powered DeFi Intent Solver for Polkadot Hub

**Say what you want. Get it done safely.**

<p align="center">
  <img src="frontend/public/demo.svg" alt="IntentDOT Demo — type intent, preview, confirm, execute" width="480"/>
</p>

IntentDOT lets you execute DeFi operations on Polkadot by simply typing what you want in natural language. An AI agent parses your intent, evaluates risks, and executes the optimal transaction — all in one interface.

## Features

- **Natural Language DeFi** — Type "Swap 10 DOT to USDT" instead of navigating complex DEX UIs
- **AI Risk Guardian** — Every swap scored GREEN/YELLOW/RED before execution. RED = blocked
- **Token Transfers** — "Send 50 USDT to 0x..." — direct token transfers via intent
- **Token Factory** — "Create a token called PEPE with 1M supply" — deploy ERC20s from chat
- **On-Chain Whitelist** — Only verified tokens can be swapped/transferred (security layer)
- **Quote Expiry Timer** — 30s countdown on previews, auto-refresh with live pool data
- **One-Click Execution** — Preview exact amounts + risk, confirm, done
- **Polkadot Hub Native** — Built on Polkadot Hub EVM (Solidity smart contracts)

## Architecture

```
Chat UI → AI Parser → Risk Guardian → TX Preview → Smart Contracts
                                                     ├── IntentExecutor → MockDEX (swap)
                                                     ├── IntentExecutor → Transfer (send)
                                                     └── TokenFactory → Deploy ERC20 (create)
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
forge test -vvv             # 26 contract tests
cd ../frontend && npm test  # 114 frontend + E2E tests

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
| Frontend | Next.js 14, Tailwind CSS, wagmi v2 |
| AI | Anthropic Claude / OpenAI GPT-4o (structured output) |
| Contracts | Solidity 0.8.19, Foundry (nightly) |
| Network | Polkadot Hub TestNet (chain 420420417) |

## Smart Contracts

| Contract | Description |
|----------|-------------|
| **IntentExecutor** | Entry point: executeSwap, executeTransfer, token whitelist |
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
| IntentExecutor V2 | `0xd5592Ce2773fF4927099B81a4de3c8739395F9e4` |
| TokenFactory | `0x8b3202E8966f7cEf13EBC4f066F742cAE8843E68` |

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
| v3 | **AI Trading Strategies** | DCA, stop-loss, scheduled execution |
| v3 | **XCM Cross-Chain** | Cross-parachain intent routing |
| v3 | **DEX Aggregation** | Route swaps through best available pool |

## Hackathon

Built for **Polkadot Solidity Hackathon 2026** (EVM Smart Contracts Track, AI-powered category).

## Tests

- **Contracts:** 26 Foundry tests — swap (9), whitelist (5), transfer (4), factory (7), events
- **Frontend:** 118 Jest tests — intent validation (38), risk scoring (22), preview builder (25), integration (12), E2E testnet (21)
- **Total:** 144 tests (26 contract + 118 frontend/E2E)
- Run: `cd contracts && forge test -vvv` / `cd frontend && npm test`

## License

MIT
