# Runbook — IntentDOT

## Prerequisites

- [ ] Node.js 20+ installed
- [ ] Foundry **nightly** installed (`curl -L https://foundry.paradigm.xyz | bash && foundryup --install nightly`)
- [ ] MetaMask browser extension
- [ ] Anthropic API key or OpenAI API key
- [ ] Polkadot Hub TestNet testnet tokens (from faucet)

## Environment Setup

```bash
# Clone repository
git clone https://github.com/<your-org>/IntentDOT.git
cd IntentDOT

# Install frontend dependencies
cd frontend
npm install

# Configure environment
cp ../.env.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_RPC_URL=https://eth-rpc-testnet.polkadot.io/
#   OPENAI_API_KEY=sk-...
#   DEPLOYER_PRIVATE_KEY=0x...

# Install contract dependencies
cd ../contracts
forge install
```

## Local Development

```bash
# Terminal 1: Start local Anvil chain (for development)
cd contracts
anvil --chain-id 31337

# Terminal 2: Deploy contracts to local chain
cd contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Terminal 3: Start frontend
cd frontend
npm run dev
# Open http://localhost:3000
```

## Run Tests

```bash
# Contract tests (37 tests)
cd contracts
forge test -vvv

# Frontend tests (150 tests: intent-validator, risk-guardian, preview-builder, risk-display, xcm-encoder, integration-flow)
cd frontend
npm test

# Lint
cd frontend
npx eslint src/ --ext .ts,.tsx

# Full build check
cd frontend
npx next build
```

## Deployment

### Get Testnet Tokens

1. Go to [faucet.polkadot.io](https://faucet.polkadot.io/)
2. Select **Network:** Polkadot testnet (Paseo)
3. Select **Chain:** Hub (smart contracts)
4. Paste your deployer `0x...` address
5. Request PAS tokens (need ~5000 PAS for deployment)

### Testnet (Polkadot Hub TestNet)

> **Critical:** Polkadot Hub TestNet requires specific tooling:
> - **Foundry nightly** — stable build doesn't handle Polkadot Hub's EVM correctly
> - **Solidity 0.8.19** — versions 0.8.20+ generate PUSH0 (EIP-3855) which is not supported
> - **`evm_version = "london"`** in foundry.toml — avoids unsupported opcodes
> - **`--legacy` flag** — EIP-1559 transactions are not supported on this chain

```bash
# Ensure Foundry nightly is installed
foundryup --install nightly

# Deploy contracts (note --legacy flag is required)
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://eth-rpc-testnet.polkadot.io/ \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --legacy

# Note deployed addresses from deploy output, update frontend/.env.local:
#   NEXT_PUBLIC_INTENT_EXECUTOR=0x...
#   NEXT_PUBLIC_MOCK_DEX=0x...
#   NEXT_PUBLIC_DOT_TOKEN=0x...
#   NEXT_PUBLIC_USDT_TOKEN=0x...
#   NEXT_PUBLIC_USDC_TOKEN=0x...
# These are required for on-chain pool reads and swap execution.
# Without them, the app uses hardcoded seeded pool stubs for preview.

# Deploy frontend
cd frontend
npx vercel --prod
```

### Seed MockDEX Pools

```bash
cd contracts
forge script script/SeedPools.s.sol \
  --rpc-url https://eth-rpc-testnet.polkadot.io/ \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --legacy
```

### Current Deployed Addresses

| Contract | Address |
|----------|---------|
| DOT Token | `0x0Fb72340AA780c00823E0a80429327af63E8d2Fc` |
| USDT Token | `0x12e41FDB22Bc661719B4D7445952e1b51C429dDB` |
| USDC Token | `0x540De5E6237395b63cFd9C383C47F5F32FAb3123` |
| MockDEX | `0x5b2810428f3DA3400f111f516560EE63d44c336A` |
| IntentExecutor V3 | `0xdD44bd254dD0bBB6Bfe7C7C062aDA4150e1546d7` |
| TokenFactory | `0x1Ba4FDBab1C786Bd0aE8c4105711b90dDf87FCDD` |
| RiskEngine (PVM Rust) | `0xEE6deEd91F29143521a4443553479A5fB97BdfA7` |

**Deployer:** `0x16Fc1792b61b2C1e93702cC5d2457d1Fd22500BA`
**Seeded Pools:** DOT/USDT (50K/337.5K), DOT/USDC (50K/337.5K)

## Common Issues

### MetaMask не подключается к Polkadot Hub TestNet
**Symptom:** "Chain not supported" error
**Cause:** Сеть не добавлена в MetaMask
**Fix:** Добавить сеть вручную: RPC `https://eth-rpc-testnet.polkadot.io/`, Chain ID `420420417`, Symbol `PAS`

### AI Parser возвращает ошибку
**Symptom:** "Failed to parse intent" в чате
**Cause:** OpenAI API key невалиден или rate limit
**Fix:** Проверить OPENAI_API_KEY в .env.local, проверить баланс на platform.openai.com

### Транзакция revert на testnet
**Symptom:** MetaMask показывает "Transaction failed"
**Cause:** Недостаточно тестовых токенов или pool не засеян
**Fix:** Получить токены из faucet, проверить что SeedPools скрипт выполнен

### Forge build fails
**Symptom:** Compilation errors
**Cause:** Неправильная версия Solidity или missing dependencies
**Fix:** `foundryup --install nightly` для обновления, `forge install` для зависимостей

### Deploy tx fails with status 0 on Polkadot Hub
**Symptom:** Transaction sent but receipt shows `status: 0`, contract not deployed
**Cause:** Stable Foundry build incompatible with Polkadot Hub EVM, or Solidity 0.8.20+ generates PUSH0
**Fix:** 1) Install Foundry nightly: `foundryup --install nightly` 2) Use Solidity 0.8.19 3) Set `evm_version = "london"` in foundry.toml 4) Use `--legacy` flag

### EIP-1559 not supported error
**Symptom:** `EIP-1559 not activated` or transaction type error
**Cause:** Polkadot Hub TestNet does not support EIP-1559 (type 2) transactions
**Fix:** Add `--legacy` flag to all forge script commands

### XCM Bridge Dependencies

The XCM bridge feature (`src/lib/xcm-encoder.ts`) requires `@polkadot/api` for SCALE encoding of XCM messages. It connects to Asset Hub Paseo via WebSocket:

- Primary: `wss://sys.ibp.network/asset-hub-paseo`
- Fallback: `wss://pas-rpc.stakeworld.io/assethub`, `wss://rpc.ibp.network/paseo`

The connection is used only for type encoding (no extrinsics submitted from the backend). The actual XCM execution happens via the XCM Precompile at `0x00000000000000000000000000000000000a0000` on Polkadot Hub, called through wagmi/viem from the frontend.

## Monitoring

- Contract events: слушать `IntentExecuted` event через viem
- AI parsing: логировать input/output в browser console
- Risk scores: логировать score distribution в console
- TX success rate: отслеживать confirmed vs reverted в UI
