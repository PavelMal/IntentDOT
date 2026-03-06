# Security Checklist

## Secrets

- [ ] No secrets in source code
- [ ] `.env` in `.gitignore`
- [ ] API keys use environment variables
- [ ] Private keys never logged or exposed

## Input Validation

- [ ] All user inputs sanitized
- [ ] Input length limits enforced
- [ ] SQL/NoSQL injection prevented (parameterized queries)
- [ ] XSS prevented (output encoding)

## Authentication & Authorization

- [ ] Auth tokens have expiration
- [ ] Sensitive endpoints require authentication
- [ ] Role-based access where applicable
- [ ] Session management secure

## Smart Contracts (if applicable)

- [ ] Reentrancy guards on external calls
- [ ] Check-Effects-Interactions pattern used
- [ ] No `tx.origin` for auth
- [ ] Integer overflow handled
- [ ] Access control on admin functions
- [ ] Static analysis run (Slither/Mythril)
- [ ] External inputs validated at contract boundary

## AI/LLM (if applicable)

- [ ] User input not passed as system prompt
- [ ] AI outputs validated against schema
- [ ] Human confirmation before financial actions
- [ ] Rate limiting on AI endpoints
- [ ] All AI actions logged for audit

## Dependencies

- [ ] Versions pinned
- [ ] `audit` command run with no critical findings
- [ ] Minimal dependency set

## Findings

| # | Severity | Description | Status | Fix |
|---|----------|-------------|--------|-----|
| | | | | |
