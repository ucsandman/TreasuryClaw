# TreasuryClaw Demo Runbook

This runbook is designed to keep the submission credible, demonstrating two live spend rails: a funded AgentCash paid-API rail (Mode A) and a rewired Mainnet wallet path for On-Chain Receipts (Mode B).

## Demo modes

### Mode A: Governed-spend-first demo (AgentCash)

Use this to demonstrate the AgentCash rail, which represents micro-transactions and API spend governed by DashClaw policies.

What you show:
1. The terminal showing `npm run demo:paid` hitting the DashClaw approval block.
2. The DashClaw Dashboard / terminal approval.
3. The successful AgentCash fetch of the paid endpoint.
4. The [AgentCash receipt tx on Base](https://basescan.org/tx/0x071220125c800dc6c37ea3daee61272ec158d364ac63be6c9d62c492ee68aa2f).

### Mode B: Live funded on-chain demo (Ethereum Mainnet)

Use this to demonstrate the full On-Chain execution rail: ERC-8004 identity registration and DashClaw decision receipts written to Ethereum Mainnet.

What you show:
1. Terminal output of `node src/demo.js --cycles 1 --auto-approve`.
2. The ERC-8004 Identity Registration success on Etherscan (Agent ID 29081):
   [Etherscan TX](https://etherscan.io/tx/0x2273c3a6250c842573f2c2b468afeb58a7af4b0705d3217920b4375286cf73ba)
3. The Portfolio analysis determining a `buy_eth` direction based on real ETH price.
4. The DashClaw governance approval gate.
5. The final DashClaw Decision Receipt written to Etherscan:
   [Etherscan TX](https://etherscan.io/tx/0x98ef86a0a8da3a45f61d6a178a8930a5d42bced8b14bfcfed1b47a6fdab84fe3)
6. *Honest caveat*: Clarify that the actual Uniswap swap execution within the cycle was mocked due to Mainnet gas constraints, but the entire governance, identity, and receipt pipeline ran live on Mainnet.

## Pre-upload checklist

- [x] `npm run frame:repo`
- [x] `npm run verify:local`
- [x] `npm run test:policies`
- [x] README matches current reality
- [x] `docs/submission-status.md` matches current wallet funding state
- [x] Explorer links captured for real on-chain events
- [x] No secrets or `.env` changes in git diff
