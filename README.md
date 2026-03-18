# TreasuryClaw

**Autonomous Treasury Agent — governed by DashClaw, verified on Ethereum.**

An AI agent fleet that manages a crypto treasury with real market data, real DEX swaps, and real blockchain governance. Every decision is policy-checked, human-approvable, and permanently recorded on-chain.

> Synthesis Hackathon 2026 — **Agents that Pay** + **Agents that Trust**

---

## What is TreasuryClaw?

TreasuryClaw is an autonomous treasury management system built as a fleet of three cooperating agents — Monitor, Decide, and Report — governed by [DashClaw](https://github.com/ucsandman/DashClaw). It reads real ETH/USD prices from four free APIs (Binance, Coinbase, DeFi Llama, CryptoCompare), analyzes portfolio allocation with risk scoring, and executes real Uniswap V3 swaps on Sepolia testnet. Every swap proposal passes through DashClaw's policy firewall with optional human approval, and every outcome is recorded as a keccak256 hash in Sepolia calldata — verifiable by anyone on Etherscan. The agent registers its identity on Base Mainnet via the ERC-8004 standard, and every decision is replayable at `dashclaw.io/replay/<action_id>`.

Nothing is mocked. Prices are live. Swaps are on-chain. Governance is enforced.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TreasuryClaw Agent Fleet                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Binance ─┐                                                        │
│   Coinbase ─┼─→ Price Feed ─→ Market Analyzer ─→ Rebalance Proposal │
│   DeFi Llama┤       (4 APIs, median cross-validation)               │
│   CryptoCompare                                                     │
│                                         │                           │
│                                         ▼                           │
│                              ┌─────────────────────┐                │
│                              │    DashClaw Guard    │                │
│                              │  Policy Check + HITL │                │
│                              │  Learning Context    │                │
│                              └────────┬────────────┘                │
│                                       │                             │
│                          ┌────────────┼────────────┐                │
│                          ▼            ▼            ▼                │
│                   Uniswap V3    On-chain       ERC-8004             │
│                   SwapRouter    Receipt Hash   Identity             │
│                   (Sepolia)     (Sepolia)      (Base)               │
│                                                                     │
│                          └────────────┬────────────┘                │
│                                       ▼                             │
│                              DashClaw Learning Loop                 │
│                         Scored Outcomes → Learned Patterns           │
│                         → Guard Enrichment → Smarter Decisions       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## On-Chain Artifacts

Everything a judge needs to verify is on a public blockchain.

| Artifact | Chain | Contract / Address | Explorer |
|----------|-------|--------------------|----------|
| ERC-8004 Agent Identity | Base Mainnet | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | [BaseScan](https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| ERC-8004 Reputation | Base Mainnet | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | [BaseScan](https://basescan.org/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) |
| Uniswap V3 Swaps | Sepolia | SwapRouter02: `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` | [Etherscan](https://sepolia.etherscan.io/address/0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E) |
| Decision Receipt Hashes | Sepolia | 0-value self-txs with keccak256 calldata | Logged per-run in console output |
| WETH (test token) | Sepolia | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | [Etherscan](https://sepolia.etherscan.io/token/0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14) |
| USDC (test token) | Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | [Etherscan](https://sepolia.etherscan.io/token/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) |

---

## The Governance Loop

Every treasury action passes through a four-step governance loop before execution.

```
1. GUARD        DashClaw policy check — risk scoring, token allowlists,
                amount caps, behavioral drift detection

2. RECORD       Create a verifiable action record with declared goal,
                risk score, and full metadata

3. VERIFY       Human-in-the-loop approval for high-risk proposals
                (auto-approve for low-risk rebalances under policy thresholds)

4. OUTCOME      Record execution result, submit quality feedback,
                write keccak256 receipt hash to Sepolia calldata
```

Policy rules from `dashclaw-config.json`:

| Policy | Scope | Threshold | Approval |
|--------|-------|-----------|----------|
| Max swap amount | `uniswap_swap` | $1,500 USD | Required above threshold |
| Rebalance only | `uniswap_swap` | Approved pairs, <0.5% slippage | Auto |
| No high risk | `*` (all actions) | Risk score >= 60 | Required |

The guard also returns **learning context** — recent score averages, behavioral drift status, and feedback summaries — so the agent adjusts its behavior in real time.

---

## The Learning Loop

DashClaw tracks every outcome and feeds patterns back into future decisions.

```
Execute swap → Record outcome → Submit quality feedback (1-5)
                                        │
                                        ▼
                              DashClaw scores outcomes
                              Extracts learned patterns
                              Detects behavioral drift
                                        │
                                        ▼
                              Guard returns learning context
                              on next cycle's policy check
                                        │
                                        ▼
                              Agent adjusts risk tolerance
                              and rebalance strategy
```

Before every decision, the agent calls `dc.getLessons()` to retrieve guidance from past swap outcomes — confidence scores, risk caps, and execution quality patterns. After every swap, it calls `dc.submitFeedback()` with a quality rating. Over time, the guard's learning context reflects the agent's track record: recent score averages, baseline comparisons, and drift alerts.

This is not static policy. The governance layer gets smarter as the agent operates.

---

## Run the Demo

### Prerequisites

1. **Node.js 20+** — `node --version`
2. **Free Sepolia ETH** — [Google Cloud Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
3. **Free Sepolia USDC** — [Circle Faucet](https://faucet.circle.com) (select Sepolia, mint USDC)
4. **Free Sepolia RPC** — [Alchemy](https://www.alchemy.com/) (create free app, select Sepolia)
5. **Base wallet** — Any wallet with a small amount of ETH on Base Mainnet (~$0.10 for ERC-8004 registration gas)

### Setup

```bash
git clone git@github.com:ucsandman/TreasuryClaw.git
cd TreasuryClaw
npm install
cp .env.example .env
```

### Configure `.env`

```env
# Sepolia testnet
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_FREE_KEY
SEPOLIA_PRIVATE_KEY=0x_your_sepolia_wallet_private_key

# Base mainnet (for ERC-8004 identity)
BASE_PRIVATE_KEY=0x_your_base_wallet_private_key

# DashClaw
DASHCLAW_BASE_URL=http://localhost:3000
DASHCLAW_API_KEY=your_dashclaw_api_key
```

### Run

```bash
# 50 governed treasury cycles with real prices and real swaps
node src/demo.js --cycles 50

# With auto-approval (no manual HITL)
node src/demo.js --cycles 50 --auto-approve

# Custom timing
node src/demo.js --cycles 20 --delay 5000
```

Each cycle: reads live ETH price, analyzes portfolio allocation, proposes a rebalance, passes DashClaw guard, executes a Uniswap V3 swap on Sepolia, writes a decision receipt hash on-chain, and submits quality feedback to the learning loop.

---

## DashClaw Methods Used

17 of 45 SDK methods — DashClaw v2.5.0.

| # | Method | Purpose |
|---|--------|---------|
| 1 | `guard()` | Policy check with learning context before every swap |
| 2 | `createAction()` | Create verifiable action record with risk score and metadata |
| 3 | `updateOutcome()` | Record execution result (completed/failed) |
| 4 | `waitForApproval()` | Block until human approves high-risk proposals |
| 5 | `approveAction()` | Programmatic approval in demo/auto mode |
| 6 | `submitFeedback()` | Rate swap quality (1-5) for the learning loop |
| 7 | `getLessons()` | Retrieve learned patterns from past outcomes |
| 8 | `recordAssumption()` | Track market analysis assumptions for auditability |
| 9 | `scanPromptInjection()` | Scan LLM output for injection attacks |
| 10 | `heartbeat()` | Report agent health status every cycle |
| 11 | `createThread()` | Start a reasoning thread for each decision cycle |
| 12 | `addThreadEntry()` | Log observations and decisions within a thread |
| 13 | `closeThread()` | Close reasoning thread with summary |
| 14 | `sendMessage()` | Push status updates to the DashClaw dashboard |
| 15 | `reportConnections()` | Declare external service dependencies |
| 16 | `createHandoff()` | Session handoff with open tasks and decisions |
| 17 | `getLatestHandoff()` | Resume from previous session state |

---

## Tracks

### Agents that Pay

TreasuryClaw is an autonomous spending agent. It reads market data, decides when to rebalance a portfolio, and executes real token swaps — all without human intervention. Every dollar spent passes through DashClaw's policy firewall with transparent risk scoring, amount caps, and optional human approval. The governance layer ensures the agent can spend autonomously without spending recklessly.

### Agents that Trust

Trust is verifiable, not claimed. TreasuryClaw registers its identity on Base Mainnet via ERC-8004, writes decision receipt hashes to Sepolia calldata (keccak256 of the full decision record), and logs every action through DashClaw's audit trail. Any observer can verify what the agent decided, why it decided it, what the guard's verdict was, and what the outcome was — on-chain and through the replay URL.

---

## Partner Integrations

### Uniswap

Real Uniswap V3 `exactInputSingle` swaps via SwapRouter02 on Sepolia. Token approvals, slippage parameters, and swap execution are all handled through viem contract calls — no wrapper SDKs.

### Base

ERC-8004 agent identity registration on Base Mainnet. The agent mints a soulbound identity token on the Identity Registry and can submit reputation feedback on the Reputation Registry. Both contracts are live on Base.

### Venice

Referenced as the LLM provider for private, no-retention inference. The agent's market analysis prompts are designed for Venice's privacy-preserving architecture — no training data retention on treasury analysis.

---

## Built With

| Component | Technology |
|-----------|------------|
| Governance | [DashClaw SDK v2.5.0](https://github.com/ucsandman/DashClaw) — 17 of 45 methods |
| Blockchain | [viem](https://viem.sh/) — all chain interactions (Sepolia + Base) |
| DEX | Uniswap V3 SwapRouter02 (Sepolia) |
| Identity | ERC-8004 Identity + Reputation Registries (Base Mainnet) |
| Price Feeds | Binance, Coinbase, DeFi Llama, CryptoCompare (free, no API keys) |
| Runtime | Node.js 20+ ESM, zero unnecessary dependencies |
| LLM | Venice (private inference, no data retention) |

Two production dependencies: `dashclaw` and `viem`. That's it.

---

## Links

| Resource | URL |
|----------|-----|
| DashClaw (governance platform) | [github.com/ucsandman/DashClaw](https://github.com/ucsandman/DashClaw) |
| TreasuryClaw (this repo) | [github.com/ucsandman/TreasuryClaw](https://github.com/ucsandman/TreasuryClaw) |
| Replay any decision | `dashclaw.io/replay/<action_id>` |
| ERC-8004 Identity Registry | [BaseScan](https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| ERC-8004 Reputation Registry | [BaseScan](https://basescan.org/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) |

---

MIT License. Built for the Synthesis hackathon, March 2026.
