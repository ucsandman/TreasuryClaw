# TreasuryClaw Demo Runbook

This runbook is designed to keep the submission credible now that TreasuryClaw has two spend rails: a funded AgentCash paid-API rail and a rewired ETH wallet path for Base/Sepolia execution.

## Demo modes

### Mode A: Governed-spend-first demo

Use this when the AgentCash rail is funded but the ETH wallet path is still short on Base or Sepolia gas.

What you show:

1. Repo status and funding constraints in `docs/submission-status.md`
2. Policy story in `docs/policy-origin-story.md`
3. Honest wedge output:
   ```bash
   npm run frame:repo
   ```
4. Safe local verification:
   ```bash
   npm run verify:local
   ```
5. DashClaw policy behavior, if the service is reachable:
   ```bash
   npm run test:policies
   ```
6. Code walkthrough of `src/demo.js`, `src/sepolia-swap.js`, `src/onchain-receipts.js`, and `src/erc8004.js`
7. State plainly that the cheapest real-money proof today is the already-funded AgentCash rail, while Base/Sepolia remain staged execution rails

Claim you can safely make:

- The agent can propose spend actions, route them through DashClaw policies, and is wired for both paid API spend and Base/Sepolia execution once the relevant rail is funded.

Claim you should not make:

- That this repo already executed a governed paid API action, a Sepolia swap, or a Base registration unless you have the matching receipt or explorer proof.

### Mode B: Live funded onchain demo

Use this only after the current ETH wallet path has:

- Base ETH for ERC-8004 writes
- Sepolia ETH for receipt writes and swaps
- Sepolia USDC if you want to show a real rebalance swap

Suggested first command:

```bash
node src/demo.js --cycles 1 --auto-approve
```

Do not start with a long run. Verify the first cycle on explorers before scaling up.

## Cheapest next proof path

### AgentCash

If you want the fastest honest paid demo, use the already-funded AgentCash wallet for one API-backed action and save the output.

### Base

If you have ETH available, the shortest onchain proof is to bridge a small amount to Base for the current wallet.

### Sepolia

Sepolia still needs testnet funding. Mainnet ETH does not solve this. Use:

- a faucet flow that supports your wallet
- or a separate funded Sepolia demo wallet/key

### Swap assets

If you only want to prove the receipt path, Sepolia ETH is enough.

If you want to prove the actual swap path, you also need Sepolia USDC in the demo wallet.

## Pre-upload checklist

- `npm run frame:repo`
- `npm run verify:local`
- `npm run test:policies` if DashClaw is reachable
- README matches current reality
- `docs/submission-status.md` matches current wallet funding state
- explorer links captured for any real onchain event
- no secrets or `.env` changes in git diff
