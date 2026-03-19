import { DashClaw } from 'dashclaw';
import config from '../dashclaw-config.json' with { type: 'json' };
import { buildGovernedPaidSpendRequest } from '../src/governed-paid-spend.js';
import { executeAgentCashFetch } from '../src/agentcash-wrapper.js';

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};

const purpose = getArg('purpose', 'submission research proof');
const query = getArg('query', 'TreasuryClaw governed agent spend demo');
const maxUsd = Number(getArg('max-usd', '1'));
const execute = args.includes('--execute');

const spendRequest = buildGovernedPaidSpendRequest({ purpose, query, maxUsd });

const dc = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: config.agentId,
});

console.log('[TreasuryClaw] Checking DashClaw guard for paid spend...');
const guardResult = await dc.guard({
  actionType: spendRequest.actionType,
  riskScore: 30,
  content: JSON.stringify(spendRequest),
});

if (guardResult.decision === 'block') {
  console.log('[TreasuryClaw] 🛑 Guard Blocked:', guardResult.reason);
  process.exit(0);
}

console.log('[TreasuryClaw] ✅ Guard Allowed:', guardResult.decision);
console.log('[TreasuryClaw] Creating action trace in DashClaw...');

const action = await dc.createAction({
  actionType: spendRequest.actionType,
  declaredGoal: spendRequest.declaredGoal,
  riskScore: 30,
  metadata: {
    operation: spendRequest.operation,
    spendRail: spendRequest.spendRail,
    service: spendRequest.service,
    provider: spendRequest.provider,
    endpoint: spendRequest.endpoint,
    purpose: spendRequest.purpose,
    query: spendRequest.query,
    maxUsd: spendRequest.maxUsd,
  },
});

console.log(`[TreasuryClaw] Action Created: ${action.action_id} [Status: ${action.status}]`);

if (!execute) {
  console.log('[TreasuryClaw] 🛑 Skipping execution (dry-run). Pass --execute to run the AgentCash API call.');
  process.exit(0);
}

// In a real full-auth flow, DashClaw could require `require_approval` and we would poll for `approved`.
// Since we set up specific agent-level policy exceptions in memory/2026-03-18.md, this might just pass 'allowed'.
if (action.status === 'pending_approval') {
  console.log(`[TreasuryClaw] ⚠️ Action requires manual approval. Please approve at ${dc.baseUrl}/actions/${action.action_id}`);
  console.log('[TreasuryClaw] Waiting for approval...');
  // Simple polling loop for approval
  let status = action.status;
  while (status === 'pending_approval') {
    await new Promise(r => setTimeout(r, 3000));
    const latest = await dc.getAction(action.action_id);
    status = latest.status;
  }
  if (status === 'rejected') {
    console.log('[TreasuryClaw] 🛑 Action rejected by human.');
    process.exit(0);
  }
  console.log('[TreasuryClaw] ✅ Action approved!');
}

console.log(`[TreasuryClaw] 💸 Executing governed paid API call to ${spendRequest.provider}${spendRequest.endpoint}...`);

const targetUrl = `https://${spendRequest.provider}${spendRequest.endpoint}`;
let finalOutcome = 'completed';
let txData = {};

try {
  const fetchResult = executeAgentCashFetch({
    url: targetUrl,
    method: 'POST',
    body: { query: spendRequest.query },
    maxUsd: spendRequest.maxUsd
  });

  if (fetchResult.success && fetchResult.data) {
    console.log('[TreasuryClaw] ✅ Paid API Call Successful!');
    const price = fetchResult.data.metadata?.price || 'unknown';
    const txHash = fetchResult.data.metadata?.payment?.transactionHash || 'none';
    const numResults = fetchResult.data.data?.results?.length || 0;
    
    console.log(`[TreasuryClaw]   - Cost: ${price}`);
    console.log(`[TreasuryClaw]   - TX Hash: ${txHash}`);
    console.log(`[TreasuryClaw]   - Results: ${numResults}`);

    txData = {
      price,
      transactionHash: txHash,
      resultsCount: numResults,
      rawOutput: fetchResult.data
    };
  } else {
    console.error('[TreasuryClaw] ❌ Paid API Call Failed:', fetchResult.error);
    finalOutcome = 'failed';
    txData = { error: fetchResult.error, rawOutput: fetchResult.rawOutput };
  }
} catch (err) {
  console.error('[TreasuryClaw] 💥 Exception during API Call:', err.message);
  finalOutcome = 'failed';
  txData = { error: err.message };
}

console.log('[TreasuryClaw] Recording on-chain receipt & outcome metadata to DashClaw...');
await dc.updateOutcome(action.action_id, {
  status: finalOutcome,
  output_summary: finalOutcome === 'completed' 
    ? `Successfully ran paid API search query via AgentCash. Cost: ${txData.price}. TX: ${txData.transactionHash}`
    : `Failed to execute governed spend: ${txData.error}`,
  metadata: {
    ...action.metadata,
    agentCashReceipt: txData
  }
});

console.log('[TreasuryClaw] 🎉 Execution complete and outcome recorded!');
