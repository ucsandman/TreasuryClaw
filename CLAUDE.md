# TreasuryClaw

## What it does
3 OpenClaw AI agents autonomously manage a demo treasury on Ethereum. They read balances, use Venice's no-retention LLM for private analysis, and execute Uniswap V3 swaps — all governed by DashClaw's policy firewall with human-in-the-loop approval and cryptographically signed receipts.

## Architecture
```
Agent 1 (Monitor) → treasury balance via onchain tool
        |
Agent 2 (Decide)  → Venice LLM (private, no-retention inference)
        |
Proposed action JSON
        |
DashClaw (guard + createAction + waitForApproval)
        |
Policy check + signed receipt (ERC-8004 compatible)
        |
Uniswap V3 swap (via Trading API)
        |
Agent 3 (Report)  → dashboard + onchain receipt
```

## Major components
- `src/treasury-agent.js` — Main agent loop with DashClaw governance
- `src/uniswap-swap.js` — Uniswap Trading API integration (check_approval → quote → swap)
- `dashclaw-config.json` — Policy rules (max amounts, allowed tokens, risk thresholds)
- `agents/` — OpenClaw agent configurations (placeholder)

## External dependencies
- **DashClaw** — Policy firewall + action recording + receipts (npm: `dashclaw`)
- **Venice AI** — No-retention LLM provider (via OpenClaw)
- **Uniswap Trading API** — Swap routing + execution
- **viem** — Ethereum client for transaction signing

## Data stores
- DashClaw instance (self-hosted) — action records, receipts, policies
- Ethereum mainnet — treasury wallet, swap execution

## Configuration
- `.env` — All secrets (DashClaw API key, Venice key, Uniswap key, wallet private key)
- `dashclaw-config.json` — Policy rules and agent settings
- `package.json` — Dependencies and scripts

## Run commands
- `npm install` — Install dependencies
- `npm start` — Run the treasury agent loop
- `npm run dev` — Run with auto-restart on file changes
- `npm test` — Run tests

## Hackathon context
Built for the Synthesis hackathon (March 17-22, 2026). Targeting:
- Open Track ($20k)
- Protocollabs — Agents With Receipts + ERC-8004 ($8,004)
- MetaMask — Best Use of Delegations ($5k)
