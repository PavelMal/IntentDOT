# MVP Scope — IntentDOT

## Goal

Доказать, что AI чат-интерфейс с Risk Guardian снижает барьер входа в DeFi на Polkadot и позволяет выполнять swap-операции быстрее и безопаснее, чем через традиционные DEX UI.

## Problem

DeFi на Polkadot требует навигации между множеством интерфейсов, ручного поиска лучших рейтов, понимания технических параметров (slippage, gas, pool liquidity). Новичкам сложно — каждый протокол имеет свой UI, ошибка в параметрах ведёт к потере средств. Нет инструмента, который объясняет риски простым языком.

## Value Proposition

Один чат: скажи что хочешь → получи AI-оценку рисков → выполни транзакцию в один клик.

## Must-Have (Minimum Viable)

1. [x] Chat UI (Next.js + Tailwind) с wallet connect (MetaMask / wagmi) — T009, T010
2. [x] AI Intent Parser: LLM → structured `{action, token_from, token_to, amount}` — T007
3. [x] IntentExecutor.sol — принимает intent, исполняет swap через mock DEX — T003
4. [x] MockDEX.sol — Uniswap V2 style AMM для демо (addLiquidity + swap) — T002
5. [x] Risk Guardian: scoring (slippage + pool liquidity) → GREEN/YELLOW/RED — T008
6. [x] Transaction Preview с risk level + Confirm/Cancel — T011
7. [x] Deploy на Polkadot Hub TestNet — T013
8. [ ] Demo video 1-3 мин — T015
9. [x] GitHub repo open source + README — T017
10. [x] Token whitelist in IntentExecutor (security layer) — T023
11. [x] Send tokens to address (transfer intent) — T022
12. [x] Create token via ERC20 factory — T024
13. [x] Quote expiry timer (30s countdown) — T021
14. [x] XCM cross-chain bridge: teleport PAS from Hub to Paseo Relay Chain via XCM precompile — T031, T032 (relay only, PAS only)

## Out of Scope (Roadmap / Nice-to-Have)

### Roadmap (Post-Hackathon)

1. **NFT Buying** — "Buy PEPE NFT" → search NFT marketplaces, show listings, execute purchase via intent
2. **NFT Creation** — "Create an NFT collection called CryptoPunks with 10K supply" → deploy ERC721, mint, set metadata
3. **People Chain Identity Transfers** — "Send 10 USDC to Alice" → resolve display name via Polkadot People Chain identity → transfer to resolved address
4. **AI Trading Strategies** — "Buy 10 DOT every day if price is below 7 USDT" → recurring DCA intents, stop-loss, scheduled execution via keeper/cron

### EIP-7702 Smooth Mode (Next Priority)

- **Zero-popup trading via EIP-7702** — user signs a one-time authorization that delegates their EOA to a smart contract. After that, all swaps and transfers execute without MetaMask popups. Currently blocked: Polkadot Hub TestNet (`pallet-revive` + `eth-rpc` proxy) rejects EIP-7702 (type 0x04) transactions. Waiting for upstream support from Parity.

### Other Future Work

- **XCM multi-chain bridging** — expand bridge destinations to parachains (Moonbeam, Astar, etc.) via ReserveAssetTransfer (currently Hub → Relay only)
- **XCM multi-asset bridging** — bridge pallet_assets tokens cross-chain (currently PAS only, ERC20 tokens are EVM-only)
- **Multi-action intents** — "Swap DOT to USDT then send to 0x..." in one intent
- **Mobile responsive** — desktop only for now
- **Mainnet deploy** — testnet only for now
- **Real price oracle** — Chainlink / DIA integration
- **Multiple DEX aggregation** — route through best pool
- **Governance intents** — "Vote YES on proposal #123"

## User Flows

### Swap (Happy Path)
```
1. User → "Swap 10 DOT to USDT"
2. AI Parser → {action: "swap", from: "DOT", to: "USDT", amount: 10}
3. Risk Guardian → GREEN (slippage 0.3%)
4. TX Preview → "Swap 10 DOT → ~67.5 USDT" [Confirm] [Cancel]
5. User confirms → MetaMask signs → IntentExecutor → MockDEX → Receipt
```

### Transfer
```
1. User → "Send 50 USDT to 0xABC..."
2. AI Parser → {action: "transfer", from: "USDT", amount: 50, recipient: "0xABC..."}
3. Transfer Preview → "Send 50 USDT → 0xABC..." [Confirm] [Cancel]
4. User confirms → IntentExecutor.executeTransfer → Receipt
```

### Create Token
```
1. User → "Create a token called PEPE with 1M supply"
2. AI Parser → {action: "create_token", tokenName: "PEPE", tokenSymbol: "PEPE", initialSupply: 1000000}
3. Create Preview → name, symbol, supply [Create Token] [Cancel]
4. User confirms → TokenFactory.createToken → new ERC20 deployed, minted, auto-whitelisted → Receipt
```

## Edge Cases

1. **Unclear intent** → AI asks: "Could you clarify? Example: 'Swap 10 DOT to USDT'"
2. **Risk = RED** → Confirm button disabled, shows reason: "Slippage 15%, blocked for safety"
3. **Insufficient balance** → "You have 5 DOT but trying to swap 10 DOT"
4. **Wallet not connected** → Chat disabled, prompt to connect

## Definition of Done

- [x] IntentExecutor.sol + MockDEX.sol deployed on Polkadot Hub TestNet — T013
- [x] Chat input → parsed intent → swap executed end-to-end — T012
- [x] Risk score GREEN/YELLOW/RED shown before every tx — T008, T011
- [x] RED risk blocks execution — T011 (Confirm button disabled)
- [x] Unclear input → AI asks for clarification — T007
- [ ] Demo video recorded (1-3 min, happy path + risk block) — T015
- [x] GitHub repo public with README — T017
- [ ] Pitch deck 5-7 slides — T016
