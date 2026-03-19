# TreasuryClaw Policy Origin Story

One of the most interesting parts of this build was not just adding guardrails to an agent, but using the agent to design the guardrails that protect its own wallet behavior.

## What happened

During the March 18, 2026 build session, Wes asked a direct question:

- How can I add a policy to DashClaw to protect you from getting your ETH stolen or tricked?
- Or make it a requirement that I approve all transactions?

That led to a concrete policy design exercise inside the live build. With the current repo state, that policy work now matters across two spend rails instead of one:

- a funded AgentCash USDC rail for paid API actions
- a rewired ETH wallet path for Base and Sepolia execution

1. Identify the exact wallet-risk classes
   - swaps and transfers
   - approvals and allowance changes
   - arbitrary contract interaction
   - wallet/config mutation
   - private key or seed exposure

2. Split the control model into layers
   - require approval for normal onchain actions
   - hard-block dangerous wallet or credential behavior
   - escalate high-risk actions
   - rate-limit wallet activity
   - use semantic checks for drain patterns and unclear destinations

3. Convert the English policy into native DashClaw policies
   - `require_approval`
   - `block_action_type`
   - `risk_threshold`
   - `rate_limit`
   - `semantic_check`

4. Import, inspect, and then repair the imported policy set through the live DashClaw API when the first import flattened some rules incorrectly

## Why this matters

The result is more than a demo safeguard. It shows a practical trust pattern for agentic finance:

- a human can ask the agent to define the rules that should constrain it
- those rules become machine-enforced policies
- the system keeps an audit trail of approval, blocking, and execution behavior across different payment rails

That creates a useful inversion: the agent is not asking for more autonomy. It is helping define the boundaries of its own autonomy.

## Current policy stack

- Approval gate for wallet and onchain actions
- Hard block for wallet credential/config mutation
- High-risk escalation
- Wallet action rate limiting
- Semantic block for key exposure
- Semantic approval for unclear destinations
- Semantic block for unlimited approvals and drain patterns

## Submission angle

This conversation became part of the project story because it demonstrates the core thesis behind TreasuryClaw:

**Agents that pay need agents that trust, and trust requires explicit, enforceable limits.**

## Current demo implication

Even before the ETH wallet has Base and Sepolia gas for a fully live chain demo, this policy story remains essential, but it is now strongest when framed as governed spending:

- the agent can define the kinds of spend behavior that should be constrained
- DashClaw can enforce those constraints on both paid API spend and onchain execution attempts
- the human can inspect and approve the resulting autonomy boundary

That makes the governed-agent-spend-first demo legitimate even when the final Base and Sepolia execution steps are still waiting on funding.
