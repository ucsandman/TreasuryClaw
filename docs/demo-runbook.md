# TreasuryClaw Demo Runbook

This runbook keeps the demo credible by separating paid API spend, on-chain
receipt writes, and mocked swap execution.

## Demo Modes

### Mode A: Governed Paid API Spend

Use this to demonstrate AgentCash micro-transactions/API spend governed by
DashClaw policies.

```bash
npm run demo:paid
```

What you show:

1. The terminal showing `npm run demo:paid` creating a governed spend action.
2. The DashClaw approval gate.
3. The successful AgentCash fetch of the paid endpoint.
4. The [AgentCash receipt tx on Base](https://basescan.org/tx/0x071220125c800dc6c37ea3daee61272ec158d364ac63be6c9d62c492ee68aa2f).

Do not run this path unless you intend to use the configured AgentCash wallet and
paid endpoint.

### Mode B: On-Chain Identity And Decision Receipt

Use this to demonstrate the governance-to-receipt path: live price read,
portfolio analysis, DashClaw guard/approval, ERC-8004 identity, and Ethereum
Mainnet decision receipt.

```bash
node src/demo.js --cycles 1 --auto-approve
```

What you show:

1. Terminal output for one demo cycle.
2. ERC-8004 identity registration on Ethereum Mainnet:
   [Etherscan TX](https://etherscan.io/tx/0x2273c3a6250c842573f2c2b468afeb58a7af4b0705d3217920b4375286cf73ba)
3. Portfolio analysis choosing a `buy_eth` or `sell_eth` direction from a live
   ETH price.
4. The DashClaw governance approval gate.
5. Final DashClaw decision receipt written to Ethereum Mainnet:
   [Etherscan TX](https://etherscan.io/tx/0x98ef86a0a8da3a45f61d6a178a8930a5d42bced8b14bfcfed1b47a6fdab84fe3)
6. The explicit caveat: the Uniswap swap execution in this demo cycle is mocked.

Do not present the mock swap reference as an on-chain swap transaction.

## Local Verification

```bash
npm run frame:repo
npm run verify:local
```

`npm run test:policies` is useful when a DashClaw instance is available, but it
is not part of local-only verification because it needs external credentials and
may create approval records.

## Pre-Recording Checklist

- [ ] README states that TreasuryClaw is a DashClaw governed spend reference app.
- [ ] `docs/submission-status.md` distinguishes live governance/receipts from the
      mocked swap.
- [ ] `.env` remains local and uncommitted.
- [ ] Explorer links shown are for real identity/receipt transactions only.
- [ ] No live mainnet swap or paid API command is run accidentally.
