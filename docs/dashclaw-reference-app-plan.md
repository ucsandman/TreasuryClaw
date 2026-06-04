# DashClaw Reference App Plan

TreasuryClaw should stay outside DashClaw core as a reference app. It is most
valuable as a concrete, inspectable example of governed agent spend rather than
as platform runtime code.

## Why It Stays Outside Core

- It contains domain-specific treasury assumptions: target ETH allocation,
  rebalance thresholds, token choices, and demo wallet behavior.
- It depends on external rails that not every DashClaw deployment should ship
  with by default: AgentCash, Uniswap, Ethereum RPC providers, and ERC-8004
  contracts.
- It preserves hackathon proof history, including mocked swap execution, which is
  useful context for a demo but not appropriate as core product behavior.
- It is easier to keep security boundaries obvious when live-spend examples are
  isolated from the DashClaw platform codebase.

## Suggested Destination If Vendored

If DashClaw vendors this project, use:

```text
examples/governed-treasury
```

That location makes the intent clear: this is a runnable example and integration
template, not part of the platform service.

## What To Extract Into DashClaw Later

- **Governed spend workflow template:** A reusable flow for proposal, guard,
  approval, execution, outcome, and replay.
- **Policy templates:** Starter policies for `paid_api_spend`, `swap`,
  `transfer`, `approve`, max amount, max slippage, allowed assets, and
  human-in-the-loop thresholds.
- **Receipt/evidence bundle adapter:** A first-class way to attach hashes,
  explorer URLs, policy decisions, approval metadata, and replay links to an
  action.
- **ERC-8004 adapter:** Optional identity and feedback helpers for teams that
  want agent identity/reputation proofs.
- **Replay improvements:** A financial-action replay view that highlights
  proposed amount, asset pair, risk score, guard result, approval, execution
  outcome, receipt hash, and external transaction references.
- **Demo data generator:** A safe local generator for treasury balances, price
  movements, approval outcomes, and mocked swap results.

## Reference App Shape

Keep the app small and explicit:

- Mode A: governed paid API spend via AgentCash.
- Mode B: Ethereum Mainnet identity and decision receipt.
- Optional mock swap path for local and low-risk demos.
- Separate live execution adapters from mocked demo adapters.
- Keep all live actions opt-in and documented.

## Product Principle

TreasuryClaw should answer: "What does DashClaw make possible for autonomous
agent spend?" DashClaw core should provide the primitives; this repo should show
how those primitives compose in a real-looking financial workflow.
