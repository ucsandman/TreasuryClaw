# TreasuryClaw - Finish Checklist

## Submission-critical

- [x] TreasuryClaw wallet path rewired to the current demo wallet
- [x] Strongest wedge re-framed as governed-agent-spend-first
- [x] DashClaw wallet policy story documented
- [x] Local unit-test path works in this restricted environment
- [x] Submission docs now distinguish verified behavior from blocked live writes
- [x] Capture one governed AgentCash paid-call receipt or output for the submission package
- [x] Run `npm run test:policies` against a reachable DashClaw instance and save the output for the submission package
- [x] Capture final wallet balances and explorer links after any live funding or writes
- [x] Push the final repo state to GitHub

## Minimum viable demo

- [x] Live ETH price path
- [x] Real portfolio analysis and risk scoring
- [x] DashClaw guard / approval smoke-test path
- [x] Honest governed-spend framing output via `npm run frame:repo`
- [x] Repo-visible governed paid API action path using the funded AgentCash rail
- [x] Run the new `npm run demo:paid` path against reachable DashClaw and capture the created action/output for the submission package
- [x] Ethereum Mainnet wallet for ERC-8004 write path (Agent ID 29081)
- [x] Ethereum Mainnet ETH for decision receipt writes
- [x] Mainnet execution cycle (Uniswap swap execution mocked to save gas, but full governance and receipt logic proved live)

## Best next unblock

- [x] Use the funded AgentCash wallet for one paid API-backed governed action
- [x] Repoint the demo away from Sepolia/Base to Ethereum Mainnet due to gas constraints
- [x] Write final decision receipt to Mainnet and verify on Etherscan
- [x] Re-run the live demo with one cycle first
- [ ] Record a short judge-facing walkthrough using the runbook in `docs/demo-runbook.md`

## Nice-to-have after the above

- [ ] Deploy a public DashClaw dashboard or replay surface
- [ ] Record the 2-minute Loom demo
- [ ] Submit via the Synthesis portal
