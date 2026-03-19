# TreasuryClaw

Governed agent spend demo built for the Synthesis Hackathon 2026.

TreasuryClaw combines live ETH price reads, portfolio rebalance logic, DashClaw approval policies, and two available payment rails:

- a funded AgentCash USDC wallet that has already purchased API credits
- a rewired ETH wallet path prepared for Base and Sepolia execution

## Chosen Wedge

The strongest honest framing is `governed-agent-spend-first`.

Why this is stronger than `swap-first`, `payment-first`, or `policy-first` alone:

- one spend rail is already funded and historically used
- the repo already contains governed onchain execution code for the second rail
- the main remaining gap is funding and proof for live Base/Sepolia execution, not product logic

The important distinction is:

- Verified: the governance and proposal path is real and locally runnable
- Verified: the funded AgentCash rail exists as a real paid-spend path, even though its secrets and purchased credits are not stored in this repo
- Verified in code: Base and Sepolia execution paths exist and can be inspected locally
- Not yet proven from this repo state: successful governed paid API execution from repo runtime, Sepolia swaps, Sepolia receipt writes, and Base ERC-8004 writes from the current demo wallet path

See `docs/submission-status.md` for the current reality snapshot and `docs/demo-runbook.md` for the judge/demo path.

## Submission Reality

### Verified locally

- Multi-source ETH/USD price fetch code exists in `src/price-feed.js`
- Portfolio rebalance and risk scoring logic exists in `src/market-analyzer.js`
- DashClaw policy smoke test exists in `scripts/policy-smoke-test.mjs`
- Sepolia swap, Sepolia receipt, and Base ERC-8004 write paths exist as explicit code paths in:
  - `src/sepolia-swap.js`
  - `src/onchain-receipts.js`
  - `src/erc8004.js`
- Honest framing helper exists in `src/honest-framing.js`
- Unit tests cover the pure swap helper, market analyzer path, and framing logic

### Verified live so far

- A funded AgentCash USDC wallet exists and has previously purchased API credits
- DashClaw policy behavior for wallet-style actions:
  - `api` actions can require approval
  - `config` actions can be blocked
  - semantic drain-style prompts can be blocked

### Not yet verified live from the current repo path

- Paid API spend routed through DashClaw from this repo runtime
- Sepolia swap execution
- Sepolia receipt write transactions
- Base ERC-8004 writes from the current demo wallet

## Minimum Viable Demo Path

### What you can credibly demo right now

1. Show the wedge and claim surface:
   ```bash
   npm run frame:repo
   ```
2. Show the wallet-policy story in `docs/policy-origin-story.md`.
3. Run local verification:
   ```bash
   npm run verify:local
   ```
4. If DashClaw is reachable from your environment, run:
   ```bash
   npm run test:policies
   ```
5. Walk through `src/demo.js` to show the exact governed path the agent will use once the ETH rail is funded:
   - read Sepolia balances
   - fetch live prices
   - analyze allocation
   - ask DashClaw guard for a decision
   - require approval when policy says so
   - attempt swap and receipt writes only when gas exists
6. State plainly that the cheapest real-money proof today is the funded AgentCash rail, while Base and Sepolia remain staged governed execution rails

### What still blocks a full onchain demo

- No proven Base gas means no Base ERC-8004 write from the current wallet path
- No Sepolia gas means no Sepolia swap tx and no Sepolia receipt tx
- No Sepolia USDC means no Sepolia rebalance swap even after gas arrives
- Mainnet ETH by itself does not solve Sepolia funding

## Cheapest Next Real-Money Path

1. Use the funded AgentCash wallet for one governed paid API action and capture the receipt or output as spend proof.
2. Bridge a very small amount of ETH to Base for the current wallet path so Base write operations can execute.
3. Fund Sepolia separately with faucet ETH for the same wallet or provide a funded Sepolia demo key.
4. Mint or acquire Sepolia USDC if you want to show the swap path, not just receipt writes.

Mainnet ETH cannot be converted into Sepolia ETH. Sepolia still needs faucet or separately funded testnet assets.

## Repo Layout

- `src/demo.js`: end-to-end demo runner for the intended governed onchain path
- `src/treasury-agent.js`: earlier mainnet/Uniswap Trading API oriented loop
- `src/price-feed.js`: live ETH price reads from four public sources
- `src/market-analyzer.js`: rebalance and risk logic
- `src/sepolia-swap.js`: direct Sepolia SwapRouter02 integration
- `src/onchain-receipts.js`: Sepolia self-tx receipt hash writer
- `src/erc8004.js`: Base ERC-8004 identity and feedback helpers
- `src/honest-framing.js`: pure helper for honest wedge selection and claim surface
- `src/governed-paid-spend.js`: pure helper for building a governed AgentCash paid-spend request
- `scripts/policy-smoke-test.mjs`: DashClaw policy verification script
- `scripts/print-honest-framing.mjs`: prints the current repo framing summary
- `scripts/governed-paid-spend-demo.mjs`: creates a governed paid-spend action record without claiming live paid execution

## Commands

```bash
npm install
npm run frame:repo
npm test
npm run verify:local
```

If your `.env` is configured and DashClaw is reachable:

```bash
npm run test:policies
node src/demo.js --cycles 1 --auto-approve
```

Do not treat `node src/demo.js` as proof of live onchain success unless you also verify the resulting BaseScan and Sepolia Etherscan transactions.

## Environment Notes

This repo intentionally avoids committing secrets. Use `.env.example` as the template and keep `.env` local.

Relevant env vars:

- `DASHCLAW_BASE_URL`
- `DASHCLAW_API_KEY`
- `SEPOLIA_RPC_URL`
- `SEPOLIA_PRIVATE_KEY`
- `BASE_RPC_URL`
- `BASE_PRIVATE_KEY`
- `UNISWAP_API_KEY`
- `RPC_URL`
- `PRIVATE_KEY`

Some paths in the repo use the Sepolia/Base demo flow, while `src/treasury-agent.js` still reflects the earlier Trading API path. For submission, the intended story should center on governed spend across both rails: funded AgentCash today, governed Base/Sepolia execution next.

## Docs

- `docs/submission-status.md`
- `docs/demo-runbook.md`
- `docs/policy-origin-story.md`
- `docs/dashclaw-integration-guide.md`
- `tasks/todo.md`

MIT License.
