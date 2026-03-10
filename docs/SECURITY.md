# Security Checklist — IntentDOT

## Secrets

- [x] No secrets in source code (private keys, API keys)
- [x] `.env` / `.env.local` in `.gitignore`
- [x] ANTHROPIC_API_KEY / OPENAI_API_KEY via environment variable only — server-side `route.ts`
- [x] DEPLOYER_PRIVATE_KEY never in frontend code — Foundry scripts only
- [x] No private keys in git history

## Input Validation

- [x] Chat input length limited (max 500 chars) — `Chat.tsx` maxLength={500} + `intent-validator.ts` validateUserMessage
- [x] AI parser output validated against intent schema before use — `intent-validator.ts` validateParsedIntent (21 tests)
- [x] Token addresses validated (allowlist: DOT, USDT, USDC) — `intent-validator.ts` VALID_TOKENS
- [x] On-chain token whitelist enforced — `IntentExecutor.sol` whitelistedTokens mapping, onlyWhitelisted modifier
- [x] Transfer recipient validated (Ethereum address format) — `intent-validator.ts` ETH_ADDRESS_REGEX
- [x] Token name/symbol validated for create_token (1-10 alphanumeric) — `intent-validator.ts`
- [x] Amounts validated: positive, non-zero — `intent-validator.ts` + `useSwapExecution.ts` balance check
- [x] No raw user text rendered as HTML (XSS prevention) — React auto-escapes by default

## Smart Contracts

- [x] Reentrancy guard on IntentExecutor.executeSwap() and executeTransfer() — `noReentrant` modifier
- [x] Check-Effects-Interactions pattern in MockDEX.swap()
- [x] No `tx.origin` — use `msg.sender` only
- [x] Integer overflow handled (Solidity 0.8.19 built-in)
- [x] Token whitelist enforced on-chain — whitelistedTokens mapping, only owner/factory can whitelist
- [x] Factory role separation — only TokenFactory can auto-whitelist new tokens via setFactory
- [x] Transfer validation: non-zero amount, non-zero recipient, no self-transfer
- [ ] Access control on MockDEX.addLiquidity() — currently anyone can seed (testnet acceptable)
- [x] minAmountOut parameter enforced (slippage protection) — on-chain require + 1% tolerance in `useSwapExecution.ts`
- [x] On-chain risk check via Rust PVM RiskEngine — RED risk (score ≥70) reverts swap automatically
- [x] Two-layer risk protection: AI off-chain preview (soft) + Rust on-chain enforcement (hard block)
- [x] Per-pool price history — pools cannot contaminate each other's MA20/volatility data
- [x] Risk Engine owner-only: setRiskEngine restricted to contract owner
- [x] External inputs validated: token addresses, amounts > 0
- [x] Events emitted for all state changes — IntentExecuted, TokenWhitelisted, TokenCreated, RiskChecked, RiskEngineUpdated, Swapped, LiquidityAdded
- [x] Foundry tests cover: swap, transfer, whitelist, factory, risk engine, balance, slippage, zero, same token, preview, events — 37/37 pass

## AI/LLM

- [x] User chat input NOT passed as system prompt — only as user message in `route.ts`
- [x] AI output validated against strict JSON schema before any action — `intent-validator.ts`
- [x] AI cannot generate arbitrary contract calls — only "swap", "transfer", "create_token" actions allowed
- [x] Human confirmation (Confirm button) required before ANY financial tx — `TransactionPreview.tsx`
- [x] Failed parses return clarification request, not error stack traces — `route.ts`
- [ ] Rate limiting: max 10 parse requests per minute per session — not yet implemented

## Frontend

- [x] Wallet connect via wagmi (no raw private key handling) — `ConnectWallet.tsx`
- [x] TX preview shows exact amounts before signing — `TransactionPreview.tsx`
- [x] RED risk score disables Confirm button (enforced in UI) — `TransactionPreview.tsx` line 106
- [x] No sensitive data in localStorage
- [x] All external links open in new tab with rel="noopener" — `SwapReceipt.tsx`

## XCM Cross-Chain Bridge

- [x] EE-padding verified: H160 → AccountId32 appends 12 bytes of `0xEE` (pallet_revive convention) — `xcm-encoder.ts` evmToAccountId32
- [x] Minimum bridge amount enforced: existential deposit (1 PAS) + fee buffer (0.2 PAS) = 1.2 PAS minimum — `xcm-encoder.ts` minimumBridgeAmount
- [x] Address validation: rejects non-40-hex-char addresses — `xcm-encoder.ts` evmToAccountId32 throws on invalid H160
- [x] Fee buffer included: local PayFees (10% capped at 2 PAS) + remote BuyExecution (0.2 PAS) — prevents stuck funds
- [x] XCM V5 encoding via `@polkadot/api` SCALE types — no manual byte construction
- [x] WS endpoints use `wss://` (encrypted) — no plaintext connections
- [ ] Rate limiting on bridge intents — not yet implemented (acceptable for testnet)
- [ ] Bridge amount upper limit — no cap currently (testnet acceptable, production needs limits)

## Dependencies

- [x] package-lock.json committed (pinned versions)
- [ ] `npm audit` run with no critical/high findings — check before submission
- [x] Foundry dependencies pinned to specific commits
- [x] Minimal dependency set (no unnecessary packages)

## Findings

| # | Severity | Description | Status | Fix |
|---|----------|-------------|--------|-----|
| 1 | HIGH | AI could hallucinate token addresses | MITIGATED | Allowlist of valid token addresses in parser validation |
| 2 | HIGH | User could lose funds on bad swap | MITIGATED | Two-layer: AI Risk Guardian blocks RED in UI + Rust RiskEngine reverts RED on-chain; minAmountOut enforced |
| 3 | MEDIUM | API key could leak via browser network tab | MITIGATED | Parser runs server-side (API route), key never reaches client |
| 4 | LOW | MockDEX pools can be drained | ACCEPTED | Testnet only, no real value. Production would need LP protections |
| 5 | MEDIUM | TokenFactory allows anyone to create tokens | ACCEPTED | Testnet demo feature. Production would need rate limiting or fee |
| 6 | LOW | Created tokens auto-whitelisted without review | ACCEPTED | Demo feature. Production would need governance/curation |
