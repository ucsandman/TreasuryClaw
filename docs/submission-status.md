# TreasuryClaw Submission Status

Snapshot date: 2026-03-19

TreasuryClaw began as a Synthesis Hackathon 2026 submission. This document
preserves the final hackathon claim surface while making the live-vs-mocked
boundary explicit for future DashClaw reference-app reuse.

## Credible Claim Set

TreasuryClaw proves a governed-agent-spend workflow across two rails:

1. **Mode A: AgentCash API-spend rail**
2. **Mode B: Ethereum Mainnet identity and decision-receipt rail**

The project does not claim that the hackathon demo completed a live Uniswap
Mainnet swap. The final swap execution inside the demo cycle was mocked to save
gas and avoid unnecessary trading risk.

## Verified Live In Production

### Mode B: On-Chain Governance

- **ERC-8004 Agent Identity:** Successfully registered TreasuryClaw on Ethereum
  Mainnet.
  - Agent ID: `29081`
  - [Etherscan TX](https://etherscan.io/tx/0x2273c3a6250c842573f2c2b468afeb58a7af4b0705d3217920b4375286cf73ba)
- **On-Chain Decision Receipt:** The agent evaluated live portfolio data,
  triggered a DashClaw governance approval gate, and wrote the final decision
  receipt hash to Ethereum Mainnet.
  - [Etherscan TX](https://etherscan.io/tx/0x98ef86a0a8da3a45f61d6a178a8930a5d42bced8b14bfcfed1b47a6fdab84fe3)

### Mode A: AgentCash Paid API Spend

- Successfully executed a governed paid API action routed through DashClaw and
  backed by a funded AgentCash wallet on Base.
- [AgentCash TX Receipt](https://basescan.org/tx/0x071220125c800dc6c37ea3daee61272ec158d364ac63be6c9d62c492ee68aa2f)

### DashClaw Governance

- `api` actions require approval.
- `config` actions are blocked.
- DashClaw action creation correctly lands in `pending_approval`.
- The scoped wallet policy stack enforced high-risk escalation, rate limiting,
  and semantic protection for drain-style prompts.

## Verified Locally

- Unit tests pass for portfolio rebalance / risk logic.
- Governed paid-spend request shaping is covered by tests.
- Policy smoke-test tooling is present for repeatable verification via
  `npm run test:policies`, provided a reachable DashClaw instance and credentials.

## Remaining Demo Caveat

The demo loop preserves a mocked Uniswap swap result. That is intentional for a
reference app: it lets reviewers verify the governance and receipt pipeline
without authorizing a live trade.
