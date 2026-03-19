# TreasuryClaw Submission Status

Snapshot date: 2026-03-19

## Credible claim set

TreasuryClaw is a fully governed, live agent treasury system. We have successfully proven the execution of its governance model across two distinct spend rails: 

1. **Mode A: AgentCash API-spend rail (Micro-transactions)**
2. **Mode B: Ethereum Mainnet execution rail (On-chain identity and decision receipts)**

## Verified Live in Production

### Mode B: On-Chain Governance (Ethereum Mainnet)
- **ERC-8004 Agent Identity:** Successfully registered TreasuryClaw on Ethereum Mainnet. 
  - Agent ID: `29081`
  - [Etherscan TX](https://etherscan.io/tx/0x2273c3a6250c842573f2c2b468afeb58a7af4b0705d3217920b4375286cf73ba)
- **On-Chain Decision Receipts:** The agent successfully evaluated live portfolio data, triggered a DashClaw governance approval gate, and wrote the final decision receipt to Ethereum Mainnet.
  - [Etherscan TX](https://etherscan.io/tx/0x98ef86a0a8da3a45f61d6a178a8930a5d42bced8b14bfcfed1b47a6fdab84fe3)
- *(Note: The final Uniswap swap execution was mocked in the demo cycle to save mainnet gas fees, but the entire governance, identity, and receipt pipeline was executed live on Mainnet).*

### Mode A: AgentCash Paid API Spend
- Successfully executed a governed paid API action routed through DashClaw and backed by a funded AgentCash wallet on the Base network.
- [AgentCash TX Receipt](https://basescan.org/tx/0x071220125c800dc6c37ea3daee61272ec158d364ac63be6c9d62c492ee68aa2f)

### Verified live against DashClaw
- `api` actions require approval
- `config` actions are blocked
- DashClaw action creation correctly lands in `pending_approval`
- The scoped wallet policy stack is strictly enforced (high-risk escalation, rate limiting, semantic protection for drain patterns).

## Verified locally
- Local unit tests pass for portfolio rebalance / risk logic.
- Policy smoke-test tooling is present for repeatable verification (`npm run test:policies`).

## Ready for Submission
The project is completely ready for the Loom video recording and final Synthesis portal submission.
