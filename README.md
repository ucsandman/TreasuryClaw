# TreasuryClaw

**3 OpenClaw agents + DashClaw governance + Uniswap V3 = safe, autonomous treasury management**

My existing 3 OpenClaw agents read the treasury balance, ask Venice's no-retention LLM for smart rebalance ideas, DashClaw intercepts every proposed swap for policy checks + optional human approval, signs a verifiable receipt, then executes on Uniswap — all on autopilot.

## Why this crushes the Synthesis hackathon

- **Open Track ($20k)** — perfect "build whatever you want" fit
- **Protocollabs — Agents With Receipts + ERC-8004 ($8,004)** — DashClaw's signed immutable decision records are literally "receipts"
- **MetaMask — Best Use of Delegations ($5k)** — agents act via delegated intents, DashClaw adds the governance layer

## Live Demo

[Insert Loom link here]

## Architecture

```
OpenClaw Agent 1 (Monitor) --> treasury balance
          |
OpenClaw Agent 2 (Decide)  --> Venice LLM (private analysis)
          |
Proposed action JSON
          |
DashClaw (guard + createAction + waitForApproval)
          |
Policy check + signed receipt (ERC-8004 compatible)
          |
Uniswap V3 swap (via Trading API)
          |
OpenClaw Agent 3 (Report)  --> dashboard + onchain receipt
```

## Tech Stack

- **Agents**: 3 existing OpenClaw agents
- **LLM**: Venice provider (private, no-retention inference for treasury analysis)
- **Governance**: DashClaw (`npm install dashclaw`) — policy firewall + receipts
- **Execution**: Uniswap V3 via Trading API + viem
- **Identity/Receipts**: DashClaw action trails + ERC-8004 compatible
- **Wallet**: MetaMask Delegation Framework (ERC-7715) or EOA

## Quick Start

```bash
# 1. Clone and install
git clone git@github.com:ucsandman/TreasuryClaw.git
cd TreasuryClaw
npm install

# 2. Configure environment
cp .env.example .env
# Fill in your DashClaw, Venice, Uniswap, and wallet keys

# 3. Run the agent fleet
npm start
```

## How It Works

### Step-by-step flow (what judges will see in the 2-min demo)

1. **Agent 1** pings treasury balance every 5 min
2. **Agent 2** asks Venice (privately): "Current yield on this position? Market sentiment?"
3. **Agent 2** outputs action: `{ "actionType": "uniswap_swap", "tokenIn": "USDC", "tokenOut": "WETH", "amountUSD": 500 }`
4. **DashClaw** intercepts — runs policy rules — sends approval request (or auto-approves safe moves)
5. Human (or auto) approves — DashClaw signs receipt — posts receipt hash
6. **Uniswap** swap executes via Trading API — Agent 3 logs success + new TVL
7. Whole loop repeats. Every decision is replayable forever.

### Core Code (the DashClaw governance middleware)

```javascript
import { DashClaw } from 'dashclaw';

const dc = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'treasury-claw-fleet',
  guardMode: 'enforce',
  hitlMode: 'wait',
});

// Guard check before any swap
const guardResult = await dc.guard({
  actionType: 'uniswap_swap',
  riskScore: proposal.riskScore,
  content: JSON.stringify(proposal),
});

if (guardResult.decision === 'block') return;

// Create verifiable action record
const action = await dc.createAction({
  actionType: 'uniswap_swap',
  declaredGoal: proposal.goal,
  riskScore: proposal.riskScore,
  metadata: { tokenIn: 'USDC', tokenOut: 'WETH', amountUSD: 500 },
});

// Execute swap, then record outcome
await dc.updateOutcome(action.action_id, {
  status: 'completed',
  outputSummary: 'Swapped $500 USDC -> WETH',
});
```

## Policy Rules (dashclaw-config.json)

| Policy | Action | Threshold | Approval |
|--------|--------|-----------|----------|
| Max swap amount | uniswap_swap | $1,500 | Required |
| Rebalance only | uniswap_swap | Approved pairs only, <0.5% slip | Auto |
| No high risk | * | Risk >= 60 | Required |

## Dashboard & Receipts

- Real-time Mission Control at your DashClaw instance
- Every decision has a permanent replay link + signed evidence
- Exportable audit trails for hackathon judges

## Environment Variables

See [`.env.example`](.env.example) for all required configuration.

| Variable | Description |
|----------|-------------|
| `DASHCLAW_BASE_URL` | Your DashClaw instance URL |
| `DASHCLAW_API_KEY` | DashClaw API key |
| `VENICE_API_KEY` | Venice no-retention LLM key |
| `UNISWAP_API_KEY` | Uniswap Trading API key |
| `PRIVATE_KEY` | Demo wallet private key |
| `RPC_URL` | Ethereum RPC endpoint |
| `TREASURY_WALLET` | Treasury wallet address |

## Repo Structure

```
TreasuryClaw/
├── src/
│   ├── treasury-agent.js   # Main agent loop with DashClaw governance
│   └── uniswap-swap.js     # Uniswap Trading API integration
├── agents/                  # OpenClaw agent configurations
├── dashclaw-config.json     # Treasury policy rules
├── policies/                # Extended policy definitions
├── receipts/                # Auto-generated signed receipt JSONs
├── tests/                   # Test suite
├── docs/                    # Documentation
├── tasks/                   # Session tracking
├── .env.example             # Environment variable template
├── package.json
└── README.md
```

## Submission Checklist

- [ ] Push repo to GitHub
- [ ] Deploy live dashboard (Vercel)
- [ ] Record 2-min Loom demo
- [ ] Submit via Synthesis portal
- [ ] Tweet with @synthesis_md tag

---

Built for the Synthesis hackathon (March 2026).
Let the agents cook — safely.

Made by [@wes_sander](https://twitter.com/wes_sander) — the guy whose OpenClaw Reddit post hit 150k views.
