# Test Plan — IntentDOT

## Scope

Testing the full IntentDOT pipeline: natural language input → AI parsing → risk scoring → smart contract swap execution. Focus on correctness of parsing, accuracy of risk scores, and reliability of on-chain execution.

## Test Environments

| Environment | URL/Network | Purpose |
|-------------|-------------|---------|
| Local | Anvil (localhost:8545) | Contract development + unit tests |
| Testnet | Polkadot Hub TestNet (chain 420420417) | Integration + demo |
| Frontend | localhost:3000 / Vercel | UI testing |

## Test Cases

### Happy Path

| # | Input | Expected Output | Status |
|---|-------|-----------------|--------|
| 1 | "Swap 10 DOT to USDT" | Parse: {swap, DOT, USDT, 10} → Risk: GREEN → Swap executed | |
| 2 | "Exchange 5 DOT for USDC" | Parse: {swap, DOT, USDC, 5} → Risk: GREEN → Swap executed | |
| 3 | "Buy USDT with 20 DOT" | Parse: {swap, DOT, USDT, 20} → Risk: GREEN → Swap executed | |
| 4 | "Trade 1 DOT for USDT" | Parse: {swap, DOT, USDT, 1} → Risk: GREEN → Swap executed | |
| 5 | Connect MetaMask → see balance | Wallet address + DOT balance displayed | |

### Edge Cases

| # | Input | Expected Output | Status |
|---|-------|-----------------|--------|
| 1 | "Swap 10000 DOT to USDT" (huge amount, low liquidity) | Risk: RED → Confirm blocked, shows "High slippage" | |
| 2 | "Swap 100 DOT to USDT" (more than balance) | Error: "Insufficient balance" before tx preview | |
| 3 | "do something with my tokens" | AI asks for clarification | |
| 4 | Wallet not connected + type intent | Chat disabled, "Connect wallet first" shown | |
| 5 | Network switch during tx | Graceful error, "Wrong network" prompt | |

### Negative Cases

| # | Input | Expected Output | Status |
|---|-------|-----------------|--------|
| 1 | "What is the price of DOT?" | No tx generated, AI responds conversationally | |
| 2 | "" (empty input) | Input validation: nothing happens | |
| 3 | Very long input (1000+ chars) | Truncated or rejected, no crash | |
| 4 | Script injection: `<script>alert(1)</script>` | Sanitized, displayed as text, no execution | |
| 5 | "Swap 0 DOT to USDT" | Validation error: "Amount must be greater than 0" | |

## Triggering Test Suite (AI Intent Parser)

### Should trigger — parse as swap intent (10 cases)

1. "Swap 10 DOT to USDT" → `{action: "swap", from: "DOT", to: "USDT", amount: 10}`
2. "Exchange 5 DOT for USDC" → `{action: "swap", from: "DOT", to: "USDC", amount: 5}`
3. "Buy USDT with 20 DOT" → `{action: "swap", from: "DOT", to: "USDT", amount: 20}`
4. "I want to swap my DOT tokens to stablecoin" → `{action: "swap", from: "DOT", to: "USDT", amount: null}` → ask for amount
5. "Convert 100 DOT into USDT please" → `{action: "swap", from: "DOT", to: "USDT", amount: 100}`
6. "Trade DOT for USDT best rate" → `{action: "swap", from: "DOT", to: "USDT", amount: null}` → ask for amount
7. "swap 0.5 DOT → USDT" → `{action: "swap", from: "DOT", to: "USDT", amount: 0.5}`
8. "Can you swap DOT to USDT? Amount is 15" → `{action: "swap", from: "DOT", to: "USDT", amount: 15}`
9. "DOT to USDT, 50 tokens" → `{action: "swap", from: "DOT", to: "USDT", amount: 50}`
10. "sell 25 DOT for USDT" → `{action: "swap", from: "DOT", to: "USDT", amount: 25}`

### Should NOT trigger — no swap action (10 cases)

1. "What is the price of DOT?" → informational response, no tx
2. "How does Polkadot work?" → informational response, no tx
3. "Tell me about staking" → informational response, no tx
4. "Hello" → greeting response, no tx
5. "What's the weather?" → out of scope response, no tx
6. "Show my balance" → display balance, no tx
7. "Is DOT a good investment?" → informational response, no tx
8. "Explain XCM" → informational response, no tx
9. "What chains are on Polkadot?" → informational response, no tx
10. "Who created Polkadot?" → informational response, no tx

## Contract Test Cases (Foundry) — 37/37 pass

### IntentDOT.t.sol — 19 tests
| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | `test_swap_DOT_USDT()` | Correct output amount, reserves updated | PASS |
| 2 | `test_swap_insufficient_balance()` | Revert with "Insufficient balance" | PASS |
| 3 | `test_swap_slippage_exceeded()` | Revert with "Slippage exceeded" | PASS |
| 4 | `test_swap_zero_amount()` | Revert with "zero amount" | PASS |
| 5 | `test_swap_same_token()` | Revert with "same token" | PASS |
| 6 | `test_getAmountOut()` | Correct calculation matching Uniswap V2 formula | PASS |
| 7 | `test_addLiquidity()` | Reserves increased | PASS |
| 8 | `test_previewSwap()` | IntentExecutor.previewSwap matches DEX output | PASS |
| 9 | `test_IntentExecuted_event()` | Event emitted with correct params | PASS |
| 10 | `test_swap_reverts_non_whitelisted_token()` | Revert "token not whitelisted" | PASS |
| 11 | `test_owner_can_whitelist()` | Whitelist on/off works | PASS |
| 12 | `test_non_owner_cannot_whitelist()` | Revert "not authorized" | PASS |
| 13 | `test_whitelist_emits_event()` | TokenWhitelisted event emitted | PASS |
| 14 | `test_transfer_DOT()` | Correct transfer to recipient | PASS |
| 15 | `test_transfer_reverts_non_whitelisted()` | Revert "token not whitelisted" | PASS |
| 16 | `test_transfer_reverts_zero_address()` | Revert "zero address" | PASS |
| 17 | `test_transfer_reverts_self_transfer()` | Revert "self transfer" | PASS |
| 18 | `test_factory_can_whitelist()` | Factory role can whitelist | PASS |
| 19 | `test_non_owner_cannot_set_factory()` | Revert "not owner" | PASS |

### TokenFactory.t.sol — 7 tests
| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | `test_createToken()` | Token deployed, minted to creator | PASS |
| 2 | `test_createToken_auto_whitelists()` | Token auto-whitelisted in executor | PASS |
| 3 | `test_createToken_tracks_creator()` | Creator's tokens tracked | PASS |
| 4 | `test_createToken_emits_event()` | TokenCreated event emitted | PASS |
| 5 | `test_createToken_reverts_zero_supply()` | Revert "zero supply" | PASS |
| 6 | `test_createToken_reverts_empty_name()` | Revert "empty name" | PASS |
| 7 | `test_createToken_reverts_invalid_symbol()` | Revert "invalid symbol" | PASS |

### RiskEngine.t.sol — 11 tests
| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | `test_setRiskEngine()` | Risk engine address set | PASS |
| 2 | `test_setRiskEngine_emits_event()` | RiskEngineUpdated event emitted | PASS |
| 3 | `test_setRiskEngine_only_owner()` | Revert "not owner" for non-owner | PASS |
| 4 | `test_disableRiskEngine()` | Set to address(0) disables | PASS |
| 5 | `test_swap_green_passes()` | GREEN risk → swap succeeds | PASS |
| 6 | `test_swap_yellow_passes()` | YELLOW risk → swap succeeds | PASS |
| 7 | `test_swap_red_reverts()` | RED risk → revert "risk too high" | PASS |
| 8 | `test_swap_emits_risk_checked()` | RiskChecked event with correct params | PASS |
| 9 | `test_swap_passes_correct_reserves()` | Correct reserves passed to engine | PASS |
| 10 | `test_swap_without_risk_engine_works()` | No engine → swap works normally | PASS |
| 11 | `test_transfer_ignores_risk_engine()` | Transfers skip risk check | PASS |

## Frontend Unit Tests (Jest) — 164/164 pass

| File | Tests | Description |
|------|-------|-------------|
| `src/__tests__/intent-validator.test.ts` | 50 | validateUserMessage (8) + validateParsedIntent swap (13) + transfer (6) + create_token (11) + bridge (9) + check_balance (3) |
| `src/__tests__/risk-guardian.test.ts` | 22 | getAmountOut (4) + calculatePriceImpact (4) + assessRisk (10) + formatTokenAmount (4) |
| `src/__tests__/preview-builder.test.ts` | 25 | getPoolReserves (4) + buildPreview (14) + buildTransferPreview (4) + buildTokenCreatePreview (3) |
| `src/__tests__/risk-display.test.ts` | 28 | getRiskLabel (6) + getRiskColors (4) + formatBps (6) + parseRiskCheckedEvent (8) + display integration (4) |
| `src/__tests__/xcm-encoder.test.ts` | 15 | evmToAccountId32 (6) + evmToSS58 (2) + minimumBridgeAmount (2) + XCM constants (3) + module exports (2) |
| `src/__tests__/bridge-flow.test.ts` | 12 | Bridge preview (5) + BridgeReceipt type (2) + integration parse→validate→preview (5) |
| `src/__tests__/integration-flow.test.ts` | 12 | Full flow (6) + on-chain pool override (3) + minAmountOut (1) + receipt (1) + ABI flow (1) |
| `src/__tests__/e2e-testnet.test.ts` | 21 | Intent validation (6) + preview/risk (5) + on-chain reads (4) + swaps (3) + edge cases (3) |

## Quality Checklist

- [x] All Foundry tests pass (`forge test`) — 37/37
- [x] All Jest tests pass (`npm test`) — 164/164
- [x] ESLint clean (`npx next lint`)
- [x] Next.js build clean (`next build`)
- [x] Risk Guardian: GREEN on normal swap, YELLOW on moderate, RED on high-slippage
- [x] TX Preview shows correct amounts (Uniswap V2 formula verified in tests)
- [x] Confirm button disabled when Risk = RED
- [x] Full e2e flow works on testnet (3 successful swaps) — T014 ✅
- [x] On-chain Transaction History shows swaps, transfers, token creations from blockchain events
- [x] Bridge transactions shown in history via Blockscout API with amount (XCM precompile has no custom events)
- [x] Portfolio balances + Pool info dropdowns in header with 12s auto-refresh
- [x] Quick Action chips trigger intents correctly
- [x] Risk Engine price normalization fix deployed + verified (GREEN on normal swaps)
- [x] No console errors in production build
- [ ] Demo video demonstrates happy path + risk blocking — T015
