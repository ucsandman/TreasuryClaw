# TreasuryClaw

DashClaw governed agent spend reference app.

TreasuryClaw is a reusable demo template that shows how an autonomous agent can
propose a financial action, route it through DashClaw policy and approval gates,
record the outcome, and attach verifiable receipts. It started as a Synthesis
Hackathon 2026 project; the hackathon proof remains documented, but the repo is
now framed as a DashClaw reference implementation rather than production
treasury software.

## What This Proves

TreasuryClaw combines live ETH price reads, portfolio rebalance logic, DashClaw
approval policies, and two spend/receipt rails:

1. **Mode A: Governed paid API spend**
   - Uses AgentCash to make a paid API request.
   - Routes the spend intent through DashClaw governance.
   - Verified with a Base transaction receipt from the hackathon run.

2. **Mode B: On-chain identity and decision receipts**
   - Registers an ERC-8004-compatible agent identity.
   - Writes DashClaw decision receipt hashes to Ethereum Mainnet.
   - Uses mocked swap execution in the demo loop to avoid mainnet trading/gas
     risk.

The honest core claim is `governed-agent-spend`: an agent can evaluate live
inputs, propose a spend or swap, pass through policy enforcement and human
approval, and leave an auditable trail.

## Claim Boundaries

### Verified live

- DashClaw governance and action creation path.
- DashClaw approval behavior for governed API actions.
- AgentCash paid API spend backed by a funded wallet.
- ERC-8004 identity registration on Ethereum Mainnet.
- DashClaw decision receipt hash written to Ethereum Mainnet.

### Verified locally

- Multi-source ETH/USD price fetch code in `src/price-feed.js`.
- Portfolio rebalance and risk scoring in `src/market-analyzer.js`.
- Governed paid-spend request shaping in `src/governed-paid-spend.js`.
- Unit tests for the pure helper paths.

### Mocked or demo-only

- The final Uniswap swap inside `src/demo.js` is mocked. The demo records a
  mock swap reference so the governance and receipt flow can complete without
  spending mainnet gas on an actual trade.
- `src/treasury-agent.js` is an integration skeleton for a continuous treasury
  loop. It contains stubs for the real OpenClaw/Venice/on-chain balance path.
- `npm run test:policies` requires a reachable DashClaw instance and valid
  credentials.

## Demo Modes

### Mode A: AgentCash paid-spend rail

```bash
npm run demo:paid
```

Use this to show a governed paid API spend request flowing through DashClaw and
AgentCash.

### Mode B: On-chain receipt rail

```bash
node src/demo.js --cycles 1 --auto-approve
```

Use this to show live ETH price reads, portfolio analysis, DashClaw governance,
and an Ethereum Mainnet decision receipt. The swap result in this path is
intentionally mocked.

### Local verification

```bash
npm run verify:local
```

This runs the unit tests and syntax checks without executing paid API calls,
mainnet transactions, or approval-changing operations.

## Repo Layout

- `src/demo.js`: Mode B demo runner for governance plus on-chain decision receipts.
- `src/treasury-agent.js`: Continuous agent-loop reference skeleton.
- `src/price-feed.js`: Live ETH price reads from public sources.
- `src/market-analyzer.js`: Rebalance and risk logic.
- `src/uniswap-swap.js`: Uniswap Trading API helper.
- `src/sepolia-swap.js`: Sepolia SwapRouter helper retained for testnet experiments.
- `src/onchain-receipts.js`: Ethereum Mainnet self-transaction receipt hash writer.
- `src/erc8004.js`: Ethereum Mainnet ERC-8004 identity and feedback helpers.
- `src/honest-framing.js`: Helper for honest claim-surface selection.
- `src/governed-paid-spend.js`: Mode A governed AgentCash request helper.
- `scripts/policy-smoke-test.mjs`: DashClaw policy verification script.
- `docs/dashclaw-reference-app-plan.md`: Plan for keeping this as a reference app
  while extracting reusable DashClaw product ideas.

## Environment Notes

This repo intentionally avoids committing secrets. Use `.env.example` as the
template and keep `.env` local.

Common env vars:

- `DASHCLAW_BASE_URL`
- `DASHCLAW_API_KEY`
- `RPC_URL` or `ETHEREUM_MAINNET_RPC_URL`
- `PRIVATE_KEY` or `ETHEREUM_MAINNET_PRIVATE_KEY`
- `TREASURY_WALLET`
- `UNISWAP_API_KEY`

## Hackathon History

Built for the Synthesis Hackathon, March 17-22, 2026. The verified run links and
submission notes are preserved in:

- `docs/submission-status.md`
- `docs/demo-runbook.md`
- `docs/policy-origin-story.md`
- `docs/dashclaw-integration-guide.md`

MIT License.
