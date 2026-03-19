# TreasuryClaw Submission Status

Snapshot date: 2026-03-18

## Credible claim set

TreasuryClaw is currently strongest as a governed-agent-spend-first demo, not as a pure swap demo and not as a fully proven end-to-end live onchain treasury run.

That means the safe, honest submission claim is:

**TreasuryClaw can read live market data, compute treasury actions, route those actions through DashClaw approval policies, and apply that same governance model across two spend rails: a funded AgentCash API-spend rail today, and Base + Sepolia execution rails once the wallet has the right gas and test assets.**

## Verified today

### Verified paid-spend reality

- An AgentCash USDC wallet exists for the operator and has previously purchased API credits
- This creates a real-money spend path that does not depend on Sepolia gas

### Verified live against DashClaw

- `api` actions can require approval
- `config` actions can be blocked
- DashClaw action creation can land in `pending_approval`
- The scoped wallet policy stack is in place:
  - require approval for wallet/onchain actions
  - block wallet/config mutation
  - high-risk escalation
  - rate limiting
  - semantic protection for key exposure, unclear destinations, and drain patterns

### Verified locally

- Local unit tests pass for:
  - Uniswap Trading API helper behavior
  - portfolio rebalance / risk logic
  - honest framing logic for the current two-rail reality
- The Sepolia/Base execution code paths exist and are explicit in source
- Policy smoke-test tooling is present for repeatable verification when DashClaw is reachable

## Not yet proven live from the current repo path

- A repo-run paid API action routed through DashClaw and backed by the funded AgentCash rail
- Sepolia swap execution
- Sepolia decision receipt writes
- Base ERC-8004 writes

No claim in the README or final submission should imply those happened unless there are matching receipts or explorer links.

## Current blocker map

The current ETH wallet path still has no proven usable gas on:

- Base for ERC-8004 writes
- Sepolia for receipt writes or swaps

The funded AgentCash rail changes the story:

- It gives the project a real paid rail right now.
- It does not by itself prove the Base or Sepolia onchain path.

Having ETH available elsewhere helps only partially:

- It can be bridged to Base.
- It cannot become Sepolia ETH.

## Minimum viable demo right now

The minimum credible judge demo, without fabricating onchain success, is:

1. Show the policy origin story and why the wallet rules exist.
2. Run `npm run frame:repo`.
3. Run `npm run verify:local`.
4. Run `npm run test:policies` if DashClaw is reachable.
5. Walk through the live code path in `src/demo.js` and explain exactly where funding gates begin.

This demonstrates the most differentiated part of the project:

**A treasury agent whose spending autonomy is constrained by explicit, reviewable, machine-enforced policies across both paid API and onchain execution surfaces.**

## Best next funding path

To unlock the cheapest next proof points:

1. Use the funded AgentCash wallet for one governed paid API call and save the receipt or output as evidence.
2. Bridge a small amount of ETH to Base for the current wallet path.
3. Obtain Sepolia ETH through a faucet or funded demo key.
4. Obtain Sepolia USDC if you want a real swap, not just a receipt write.
5. Re-run the demo with `--cycles 1 --auto-approve` first and only scale up after explorer verification.

## What remains for a real live demo

- One repo-visible governed paid API execution path if you want the funded AgentCash rail demonstrated from code
- Base-funded wallet confirmation
- Sepolia-funded wallet confirmation
- One successful Sepolia receipt write
- One successful Sepolia swap
- Explorer links captured in the repo or submission notes
- Short video showing policy gate -> approval -> execution -> explorer proof
