# TreasuryClaw Submission Status

## What is done

- DashClaw governance layer is live and working
- Wallet-affecting actions are typed as `api` so policy enforcement catches them consistently
- Policy stack is live in DashClaw:
  - require approval for wallet/onchain actions
  - block wallet/config mutation
  - high-risk escalation
  - rate limiting
  - semantic protection for key exposure, unclear destinations, and drain patterns
- Policy smoke test path is added locally
- README and supporting docs now include the policy-origin story from the March 18 build session

## What was verified live

- `api` actions route into approval flow
- `config` actions are blocked
- DashClaw action creation can land in `pending_approval`

## Current blocker

The recovered TreasuryClaw wallet currently has no Sepolia ETH and no Base ETH available for the live demo path. That blocks:

- Sepolia swap execution
- onchain decision receipt writes that require gas
- Base identity registration if it requires funded execution from this wallet

## Resourceful workarounds attempted

- Switched to a public Sepolia RPC fallback (`https://ethereum-sepolia-rpc.publicnode.com`) so the project no longer depends on a private RPC just to read chain state
- Checked multiple candidate local wallets for Sepolia balance
- Tried a no-signup faucet path via Bitbond Token Tool

## Remaining external gate

The faucet path still requires connecting a wallet in-browser. Without that interactive wallet connection or another funded test wallet/private key, the fully live onchain portion cannot be completed autonomously from this environment.

## Best next unlock

Any one of these would unblock the final end-to-end demo:

1. Fund the TreasuryClaw wallet with Sepolia ETH
2. Provide a funded Sepolia private key for demo use
3. Fund the wallet on Base if Base-side live writes are required
4. Manually connect the wallet in the faucet flow and request test ETH

## Submission framing

Even with the current funding blocker, the most differentiated part of TreasuryClaw is already real:

**An agent that can propose wallet actions, get policy-checked by DashClaw, require human approval, and produce an auditable trust story around constrained autonomy.**
