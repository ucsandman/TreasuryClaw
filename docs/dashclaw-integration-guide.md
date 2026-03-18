# TreasuryClaw x DashClaw — Full Integration Guide

Complete step-by-step guide to make TreasuryClaw a fully governed, learning agent on DashClaw v2.5.0.

## Current State

TreasuryClaw already uses these v2 methods:
- `dc.guard()` — policy check before swaps
- `dc.createAction()` — records swap intent
- `dc.waitForApproval()` — blocks on human approval
- `dc.updateOutcome()` — records success/failure
- `dc.heartbeat()` — reports agent health each cycle
- `dc.reportConnections()` — declares Uniswap, Venice, RPC connections
- `dc.recordAssumption()` — tracks Venice LLM beliefs (in Decide agent)

**Broken:** `dc.mapCompliance('soc2')` — removed from v2 in 2.4.0. Remove this call.

**Missing:** 10 methods that would make this a showcase integration.

---

## Step 1: Pin SDK version

In `package.json`, change:
```json
"dashclaw": "latest"
```
to:
```json
"dashclaw": "^2.5.0"
```

Then `npm install` to update.

---

## Step 2: Fix the broken mapCompliance call

In `src/treasury-agent.js`, find and **delete** the line:
```javascript
await dc.mapCompliance('soc2');
```

This was moved to the v1 legacy SDK. If you need compliance mapping, it runs from the DashClaw dashboard — not from the agent.

---

## Step 3: Add prompt injection scanning on Venice LLM output

Venice returns LLM-generated proposals. Before trusting the output, scan it:

In `agentDecide()`, after getting the proposal from Venice, add:
```javascript
// Scan Venice LLM output for injection attacks
const scan = await dc.scanPromptInjection(JSON.stringify(proposal), { source: 'llm_output' });
if (scan.recommendation === 'block') {
  console.log(`[Decide] BLOCKED: Prompt injection detected in Venice output`);
  return null; // Skip this cycle
}
if (scan.recommendation === 'warn') {
  console.log(`[Decide] WARNING: Suspicious Venice output (risk: ${scan.risk_level})`);
}
```

Then in `runTreasuryLoop()`, add a null check after `agentDecide`:
```javascript
const proposal = await agentDecide(balance);
if (!proposal) return; // Venice output was blocked
```

---

## Step 4: Check lessons before deciding

Before the Venice LLM proposes a swap, check what DashClaw has learned from past swaps:

At the top of `agentDecide()`, add:
```javascript
// Check DashClaw for lessons from past swap outcomes
const { lessons } = await dc.getLessons({ actionType: 'uniswap_swap' });
let lessonContext = '';
if (lessons.length > 0) {
  const topLesson = lessons[0];
  console.log(`[Decide] DashClaw lesson (confidence ${topLesson.confidence}): ${topLesson.guidance}`);
  lessonContext = `\nPast performance insights: ${topLesson.guidance}`;
  if (topLesson.hints.risk_cap) {
    console.log(`[Decide] Recommended risk cap: ${topLesson.hints.risk_cap}`);
  }
}
```

When you replace the Venice LLM stub with a real call, include `lessonContext` in the prompt so Venice factors in DashClaw's learned patterns.

---

## Step 5: Use the guard learning context

The `guard()` response now includes a `learning` field. Use it to adjust behavior:

After the guard check in `runTreasuryLoop()`, add:
```javascript
// React to learning context from guard
if (guardResult.learning) {
  const lc = guardResult.learning;
  if (lc.recent_score_avg !== null && lc.recent_score_avg < 50) {
    console.log(`[Guard] WARNING: Recent swap quality is low (avg score: ${lc.recent_score_avg})`);
  }
  if (lc.drift_status === 'critical') {
    console.log(`[Guard] CRITICAL: Behavioral drift detected — proceeding with caution`);
  }
  if (lc.feedback_summary) {
    console.log(`[Guard] Feedback: ${lc.feedback_summary}`);
  }
}
```

---

## Step 6: Add context threads for each swap cycle

Wrap each treasury loop cycle in a reasoning thread so the full decision chain is replayable:

At the start of `runTreasuryLoop()`:
```javascript
// Start a reasoning thread for this cycle
const { thread } = await dc.createThread({
  name: `Treasury cycle ${new Date().toISOString()}`,
  summary: 'Evaluate and execute treasury rebalance',
});
const threadId = thread?.thread_id;
```

After each major step, add entries:
```javascript
// After Monitor
if (threadId) await dc.addThreadEntry(threadId, `Treasury TVL: $${balance.totalUSD}`, 'observation');

// After Decide
if (threadId) await dc.addThreadEntry(threadId, `Proposal: swap $${proposal.amountUSD} ${proposal.tokenIn} → ${proposal.tokenOut}`, 'decision');

// After Guard
if (threadId) await dc.addThreadEntry(threadId, `Guard: ${guardResult.decision} (risk: ${proposal.riskScore})`, 'observation');

// After Swap execution
if (threadId) await dc.addThreadEntry(threadId, `Executed: tx ${txHash}`, 'observation');
```

At the end of the cycle (success or failure):
```javascript
// In the success path (after agentReport):
if (threadId) await dc.closeThread(threadId, `Cycle complete. Swapped $${proposal.amountUSD} ${proposal.tokenIn} → ${proposal.tokenOut}`);

// In the catch block:
if (threadId) await dc.closeThread(threadId, `Cycle failed: ${err.message}`);
```

---

## Step 7: Add session handoffs

When the agent starts, check for a previous session handoff. When it stops, leave one.

At the top of the main script (after DashClaw client init):
```javascript
// Resume from last session
const { handoff } = await dc.getLatestHandoff();
if (handoff) {
  console.log(`[Handoff] Resuming from: ${handoff.summary}`);
  if (handoff.openTasks?.length) {
    console.log(`[Handoff] Open tasks: ${handoff.openTasks.join(', ')}`);
  }
}
```

Add a graceful shutdown handler:
```javascript
async function shutdown() {
  console.log('[TreasuryClaw] Shutting down...');
  await dc.createHandoff({
    sessionDate: new Date().toISOString().slice(0, 10),
    summary: `Ran ${cycleCount} cycles. Last balance: $${lastBalance || 'unknown'}`,
    openTasks: ['Verify pending swaps completed on-chain'],
    decisions: ['Used batch routing via Uniswap Trading API'],
  });
  await dc.heartbeat('offline');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

You'll need to track `cycleCount` and `lastBalance` as module-level variables.

---

## Step 8: Submit feedback on swap outcomes

After each successful swap, auto-rate the outcome based on slippage and execution quality:

After `executeUniswapSwap()` succeeds:
```javascript
// Auto-rate swap quality based on execution
const slippage = quote.slippage || 0;
const rating = slippage < 0.3 ? 5 : slippage < 0.5 ? 4 : slippage < 1.0 ? 3 : 2;
await dc.submitFeedback({
  action_id: action.action_id,
  rating,
  comment: `Swap executed. Slippage: ${slippage}%. Tx: ${txHash}`,
  category: 'execution_quality',
});
```

This feeds the learning loop — DashClaw will learn which swap patterns produce better outcomes.

---

## Step 9: Set up a quality scorer

On first run (or in a setup script), create a scorer that evaluates swap quality:

```javascript
// One-time setup — run once, then comment out
const scorer = await dc.createScorer(
  'swap-execution-quality',
  'custom_function',
  { function_body: 'const s = metadata?.slippage || 0; return s < 0.3 ? 1.0 : s < 0.5 ? 0.75 : s < 1.0 ? 0.5 : 0.2;' },
  'Scores swap quality based on slippage'
);
console.log('Scorer created:', scorer.id);
```

---

## Step 10: Send status messages to the dashboard

After each cycle, send a message that appears in the DashClaw dashboard:

```javascript
await dc.sendMessage({
  to: 'dashboard',
  type: 'status',
  subject: `Cycle ${cycleCount} complete`,
  body: `Swapped $${proposal.amountUSD} ${proposal.tokenIn} → ${proposal.tokenOut}. TVL: $${newBalance.totalUSD}. Tx: ${txHash}`,
});
```

---

## Final env vars needed

```bash
# .env
DASHCLAW_BASE_URL=http://localhost:3000   # or your deployed instance
DASHCLAW_API_KEY=oc_live_...

# Venice (OpenClaw LLM)
VENICE_API_KEY=sk-your_venice_api_key_here

# Uniswap Trading API
UNISWAP_API_KEY=your_uniswap_api_key_here

# Ethereum
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key
PRIVATE_KEY=0x_your_demo_wallet_private_key

# Treasury
TREASURY_WALLET=0x_your_treasury_wallet
MAX_SWAP_PERCENT=10
LOOP_INTERVAL_MS=300000
```

---

## Method Usage Summary

After full integration, TreasuryClaw uses **17 of 45** v2 methods:

| Method | Where | Purpose |
|--------|-------|---------|
| `guard()` | Before swap | Policy check + learning context |
| `createAction()` | Before swap | Record intent |
| `waitForApproval()` | After guard | Block for human approval |
| `updateOutcome()` | After swap | Record success/failure |
| `recordAssumption()` | In Decide agent | Track Venice LLM beliefs |
| `heartbeat()` | Each cycle + shutdown | Report health |
| `reportConnections()` | On startup | Declare external services |
| `scanPromptInjection()` | After Venice LLM | Scan output for injection |
| `getLessons()` | Before Decide | Check learned patterns |
| `createThread()` | Start of cycle | Begin reasoning trail |
| `addThreadEntry()` | After each step | Append reasoning |
| `closeThread()` | End of cycle | Complete reasoning trail |
| `createHandoff()` | On shutdown | Session continuity |
| `getLatestHandoff()` | On startup | Resume from last session |
| `submitFeedback()` | After swap | Rate execution quality |
| `sendMessage()` | After cycle | Status to dashboard |
| `createScorer()` | One-time setup | Define quality metric |

---

## What this looks like in the DashClaw dashboard

Once integrated, TreasuryClaw will show:
- **Mission Control**: Real-time swap decisions with risk scores and learning context
- **Fleet > treasury-claw-fleet**: Agent profile with governance posture, integrations, decision history
- **Security**: Risk signals if swap patterns deviate from baselines
- **Drift**: Alerts when swap behavior drifts from historical norms
- **Learning**: Velocity tracking showing whether swap quality improves over time
- **Feedback**: Auto-rated swap outcomes feeding the learning loop
- **Approvals**: Pending swaps waiting for human sign-off (for high-risk rebalances)
- **Context Threads**: Full reasoning trail for every swap cycle — replayable from start to finish
