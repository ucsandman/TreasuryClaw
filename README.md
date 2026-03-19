# TreasuryClaw

Governed agent spend demo built for the Synthesis Hackathon 2026.

TreasuryClaw combines live ETH price reads, portfolio rebalance logic, DashClaw approval policies, and two proven payment/execution rails:

1. **Mode A (AgentCash / Micro-transactions)**: A funded AgentCash USDC wallet that purchases API credits.
2. **Mode B (On-Chain / Ethereum Mainnet)**: A fully governed Ethereum Mainnet execution rail with ERC-8004 Agent Identity and on-chain decision receipts.

## Chosen Wedge

The core framing of TreasuryClaw is `governed-agent-spend`.

We are demonstrating that an autonomous agent can evaluate live market data, propose a financial action (spend/swap), route that action through strict machine-enforced governance policies (DashClaw), and cleanly execute the result on-chain or via paid APIs.

- **Verified**: The governance and proposal path is real and locally runnable.
- **Verified (Mode A)**: The AgentCash rail successfully executed governed paid-spend.
- **Verified (Mode B)**: The agent successfully registered its identity on Ethereum Mainnet (ERC-8004 Agent ID 29081) and wrote its DashClaw decision receipts to Mainnet. *(Note: To save gas, the final Uniswap swap within the demo loop was mocked, but the entire governance and receipt pipeline was proven live).*

See `docs/submission-status.md` for the current reality snapshot and `docs/demo-runbook.md` for the judge/demo path.

## Submission Reality

### Verified Live in Production

- **Agent Identity**: Registered Agent ID `29081` on Ethereum Mainnet.
- **On-Chain Governance**: Wrote DashClaw decision receipts to Ethereum Mainnet.
- **Paid API Spend**: Executed governed API purchases via AgentCash on Base.
- **DashClaw Policy Enforcement**:
  - `api` actions require approval.
  - `config` actions are blocked.
  - Semantic drain-style prompts and high-risk actions trigger escalation/blocks.

### Verified Locally

- Multi-source ETH/USD price fetch code (`src/price-feed.js`).
- Portfolio rebalance and risk scoring logic (`src/market-analyzer.js`).
- DashClaw policy smoke tests (`scripts/policy-smoke-test.mjs`).
- Unit tests cover the pure swap helper, market analyzer path, and framing logic.

## Minimum Viable Demo Path

For the judge walkthrough:

1. Show the wedge and claim surface:
   ```bash
   npm run frame:repo
   ```
2. Show the wallet-policy story in `docs/policy-origin-story.md`.
3. Run local verification:
   ```bash
   npm run verify:local
   ```
4. Demonstrate DashClaw governance blocks:
   ```bash
   npm run test:policies
   ```
5. Run the live demo on Mainnet to show the full pipeline:
   ```bash
   node src/demo.js --cycles 1 --auto-approve
   ```
   *Show the resulting Etherscan links for the identity registration and decision receipt.*

## Repo Layout

- `src/demo.js`: End-to-end demo runner for the governed on-chain path (Mode B).
- `src/price-feed.js`: Live ETH price reads from public sources.
- `src/market-analyzer.js`: Rebalance and risk logic.
- `src/sepolia-swap.js`: Uniswap SwapRouter integration (mocked in demo for Mainnet).
- `src/onchain-receipts.js`: Mainnet self-tx receipt hash writer.
- `src/erc8004.js`: Mainnet ERC-8004 identity and feedback helpers.
- `src/honest-framing.js`: Helper for honest wedge selection.
- `src/governed-paid-spend.js`: Helper for building a governed AgentCash request (Mode A).
- `scripts/policy-smoke-test.mjs`: DashClaw policy verification script.

## Environment Notes

This repo intentionally avoids committing secrets. Use `.env.example` as the template and keep `.env` local.

Relevant env vars:
- `DASHCLAW_BASE_URL`
- `DASHCLAW_API_KEY`
- `RPC_URL` (For Mainnet)
- `PRIVATE_KEY`

## Docs

- `docs/submission-status.md`
- `docs/demo-runbook.md`
- `docs/policy-origin-story.md`
- `docs/dashclaw-integration-guide.md`
- `tasks/todo.md`

MIT License.
