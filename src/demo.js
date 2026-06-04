// src/demo.js
import { DashClaw } from 'dashclaw';
import { getEthPrice, getMedianEthPrice } from './price-feed.js';
import { analyzePortfolio } from './market-analyzer.js';
import { registerAgent, getAgentCount } from './erc8004.js';
import { writeDecisionReceipt } from './onchain-receipts.js';
import config from '../dashclaw-config.json' with { type: 'json' };

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};
const CYCLES = parseInt(getArg('cycles', '50'), 10);
const DELAY = parseInt(getArg('delay', '2500'), 10);
const AUTO_APPROVE = args.includes('--auto-approve');

const dc = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: config.agentId,
});

const DASHCLAW_ACTION_TYPE = 'api';
const TREASURY_OPERATION = 'uniswap_swap';
const DEMO_CHAIN = 'ethereum-mainnet';
const MOCK_SWAP_EXPLORER_URL = 'mock://treasuryclaw/swap-not-broadcast';

// Stats tracking
const stats = {
  executed: 0, blocked: 0, approvalRequired: 0, failed: 0,
  totalVolume: 0, losses_prevented: 0,
  mockSwapReferences: [], receiptHashes: [], blockedProposals: [],
  startTime: null, endTime: null,
};

async function runCycle(cycle) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  CYCLE ${cycle}/${CYCLES}`);
  console.log('='.repeat(60));

  let action, threadId;

  try {
    // Heartbeat
    await dc.heartbeat('online', { cycle, mode: 'demo' });

    // Start reasoning thread
    try {
      const { thread } = await dc.createThread({
        name: `Demo cycle ${cycle}`,
        summary: `Governed treasury receipt demo — cycle ${cycle} of ${CYCLES}`,
      });
      threadId = thread?.thread_id;
    } catch {}

    // 1. Use a deterministic demo portfolio so no wallet balance read is required.
    const balance = { positions: [{ token: 'USDC', amount: '200.00' }, { token: 'WETH', amount: '0.01' }] };
    console.log(`[Monitor] USDC: ${balance.positions[0].amount} | WETH: ${balance.positions[1].amount}`);
    if (threadId) await dc.addThreadEntry(threadId, `Balance: USDC ${balance.positions[0].amount}, WETH ${balance.positions[1].amount}`, 'observation').catch(() => {});

    // 2. Fetch real ETH price
    const priceData = cycle % 5 === 0 ? await getMedianEthPrice() : await getEthPrice();
    console.log(`[Price] ETH/USD: $${priceData.price.toFixed(2)} (${priceData.source || priceData.sources + ' sources'})`);

    // 3. Analyze portfolio
    const analysis = analyzePortfolio(balance, priceData.price);
    console.log(`[Analyze] ETH allocation: ${analysis.currentEthAllocation}% (target: ${analysis.targetEthAllocation}%)`);
    console.log(`[Analyze] Direction: ${analysis.direction} | Amount: $${analysis.amountUSD} | Risk: ${analysis.riskScore}`);

    if (!analysis.rebalanceNeeded) {
      console.log('[Analyze] Portfolio balanced — skipping swap');
      if (threadId) await dc.closeThread(threadId, 'Portfolio balanced, no rebalance needed').catch(() => {});
      return;
    }

    if (threadId) await dc.addThreadEntry(threadId, `Proposal: ${analysis.direction} $${analysis.amountUSD} at ETH=$${priceData.price.toFixed(2)} (risk: ${analysis.riskScore})`, 'decision').catch(() => {});

    // 4. Check lessons
    try {
      const { lessons } = await dc.getLessons({ actionType: DASHCLAW_ACTION_TYPE });
      if (lessons.length > 0) {
        console.log(`[Lessons] ${lessons[0].guidance} (confidence: ${lessons[0].confidence})`);
      }
    } catch {}

    // 5. Record assumption
    await dc.recordAssumption({
      assumption: `${analysis.direction} is optimal — ETH at $${priceData.price.toFixed(2)}, allocation ${analysis.currentEthAllocation}% vs target ${analysis.targetEthAllocation}%`,
      category: 'market_analysis',
      confidence: analysis.confidence,
    });

    // 6. DashClaw guard check
    const guardResult = await dc.guard({
      actionType: DASHCLAW_ACTION_TYPE,
      riskScore: analysis.riskScore,
      content: JSON.stringify({
        ...analysis,
        operation: TREASURY_OPERATION,
        chain: DEMO_CHAIN,
        executionMode: 'mock_swap_with_live_governance_and_receipt',
        approvalContext: 'TreasuryClaw governed Uniswap rebalance',
      }),
    });

    if (guardResult.learning) {
      const lc = guardResult.learning;
      if (lc.recent_score_avg !== null) console.log(`[Learning] Recent score: ${lc.recent_score_avg} | Baseline: ${lc.baseline_score_avg}`);
      if (lc.drift_status) console.log(`[Learning] Drift: ${lc.drift_status}`);
    }

    if (guardResult.decision === 'block') {
      console.log(`[Guard] BLOCKED: ${guardResult.reason || 'Policy violation'}`);
      stats.blocked++;
      stats.blockedProposals.push({ cycle, analysis, price: priceData.price });
      if (threadId) await dc.closeThread(threadId, `Blocked: ${guardResult.reason}`).catch(() => {});
      return;
    }

    // 7. Create action
    action = await dc.createAction({
      actionType: DASHCLAW_ACTION_TYPE,
      declaredGoal: `${analysis.direction}: $${analysis.amountUSD} at ETH=$${priceData.price.toFixed(2)}. Operation=${TREASURY_OPERATION}. Chain=${DEMO_CHAIN}. ExecutionMode=mock_swap_with_live_governance_and_receipt.`,
      riskScore: analysis.riskScore,
      metadata: {
        ...analysis,
        operation: TREASURY_OPERATION,
        chain: DEMO_CHAIN,
        executionMode: 'mock_swap_with_live_governance_and_receipt',
        ethPrice: priceData.price,
        source: priceData.source,
      },
    });

    // 8. Handle approval
    if (guardResult.decision === 'require_approval') {
      stats.approvalRequired++;
      console.log(`[Approval] Required — risk score ${analysis.riskScore}`);
      if (AUTO_APPROVE) {
        await new Promise(r => setTimeout(r, 3000));
        await dc.approveAction(action.action_id, 'allow', 'Demo auto-approval');
        console.log('[Approval] Auto-approved (demo mode)');
      } else {
        console.log(`[Approval] Waiting... approve via DashClaw dashboard or: dashclaw approve ${action.action_id}`);
        await dc.waitForApproval(action.action_id, { timeout: 5 * 60 * 1000 });
        console.log('[Approval] Approved!');
      }
    }

    // 9. Mock swap execution so the live governance and receipt path can finish safely.
    console.log('[Swap] Mocking Uniswap execution; no swap transaction will be broadcast.');
    const swapResult = {
      status: 'mocked',
      referenceId: `mock-swap-${Date.now().toString(16)}`,
      explorerUrl: MOCK_SWAP_EXPLORER_URL
    };
    console.log(`[Swap] Mock reference: ${swapResult.referenceId}`);
    stats.mockSwapReferences.push(swapResult.referenceId);
    stats.executed++;
    stats.totalVolume += analysis.amountUSD;

    if (threadId) await dc.addThreadEntry(threadId, `Mock swap result: ${swapResult.referenceId}`, 'observation').catch(() => {});

    // 10. Record outcome
    await dc.updateOutcome(action.action_id, {
      status: swapResult.status,
      outputSummary: `${analysis.direction} $${analysis.amountUSD} on ${DEMO_CHAIN}. Swap execution mocked; no trade broadcast. Mock ref: ${swapResult.referenceId}`,
      costEstimate: 0,
    });

    // 11. Write on-chain decision receipt
    try {
      const receiptResult = await writeDecisionReceipt({
        agent_id: config.agentId,
        action_id: action.action_id,
        action_type: 'uniswap_swap',
        guard_decision: guardResult.decision,
        risk_score: analysis.riskScore,
        outcome: 'governance_approved_swap_mocked',
        replay_url: `${process.env.DASHCLAW_BASE_URL}/replay/${action.action_id}`,
      });
      console.log(`[Receipt] On-chain: ${receiptResult.explorerUrl}`);
      stats.receiptHashes.push(receiptResult.txHash);
    } catch (err) {
      console.log(`[Receipt] Skipped: ${err.message}`);
    }

    // 12. Submit feedback
    const rating = analysis.riskScore < 30 ? 5 : analysis.riskScore < 50 ? 4 : 3;
    await dc.submitFeedback({
      action_id: action.action_id,
      rating,
      comment: `Cycle ${cycle}: ${analysis.direction} $${analysis.amountUSD}. Swap mocked; governance and receipt path exercised. Ref: ${swapResult.referenceId}`,
      category: 'execution_quality',
    }).catch(() => {});

    // 13. Send status message
    await dc.sendMessage({
      to: 'dashboard',
      type: 'status',
      subject: `Cycle ${cycle}: ${analysis.direction} $${analysis.amountUSD}`,
      body: `ETH=$${priceData.price.toFixed(2)} | Risk: ${analysis.riskScore} | Mock swap ref: ${swapResult.referenceId}`,
    }).catch(() => {});

    // 14. Close thread
    if (threadId) await dc.closeThread(threadId, `Cycle ${cycle} complete with mocked swap ref ${swapResult.referenceId}`).catch(() => {});

  } catch (err) {
    console.error(`[ERROR] Cycle ${cycle}: ${err.message}`);
    stats.failed++;
    if (action) await dc.updateOutcome(action.action_id, { status: 'failed', outputSummary: err.message }).catch(() => {});
    if (threadId) await dc.closeThread(threadId, `Failed: ${err.message}`).catch(() => {});
  }
}

async function main() {
  stats.startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log('  TREASURYCLAW REFERENCE DEMO');
  console.log('  Live prices. Live governance. Live receipts. Mocked swap execution.');
  console.log('='.repeat(60));
  console.log(`Cycles: ${CYCLES} | Delay: ${DELAY}ms | Auto-approve: ${AUTO_APPROVE}`);
  console.log(`DashClaw: ${process.env.DASHCLAW_BASE_URL}`);
  console.log('');

  // ERC-8004: Register agent identity on Ethereum Mainnet (if not already registered)
  try {
    const count = await getAgentCount();
    if (count === 0) {
      console.log('[ERC-8004] Registering agent identity on Ethereum Mainnet...');
      const reg = await registerAgent(
        `https://github.com/ucsandman/TreasuryClaw`
      );
      console.log(`[ERC-8004] Registered! Agent ID: ${reg.agentId}`);
      console.log(`[ERC-8004] Etherscan: ${reg.explorerUrl}`);
    } else {
      console.log(`[ERC-8004] Agent already registered on Ethereum Mainnet (${count} identity/ies)`);
    }
  } catch (err) {
    console.log(`[ERC-8004] Registration skipped: ${err.message}`);
  }

  // Report connections
  await dc.reportConnections([
    { name: 'Uniswap V3 (mocked demo execution)', type: 'dex', status: 'mocked' },
    { name: 'Multi-source Price Feed', type: 'oracle', status: 'connected' },
    { name: 'ERC-8004 Identity (Ethereum Mainnet)', type: 'identity', status: 'connected' },
    { name: 'Ethereum Mainnet decision receipts', type: 'blockchain', status: 'connected' },
  ]);

  // Create session handoff
  // dc.createHandoff skipped due to 404

  // Run cycles
  for (let i = 1; i <= CYCLES; i++) {
    await runCycle(i);
    if (i < CYCLES) {
      await new Promise(r => setTimeout(r, DELAY));
    }
  }

  stats.endTime = Date.now();
  const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(0);

  // Calculate counterfactual losses from blocked trades
  // (Check what prices did after blocked proposals)
  for (const blocked of stats.blockedProposals) {
    try {
      const laterPrice = await getEthPrice();
      const priceDelta = laterPrice.price - blocked.price;
      if (blocked.analysis.direction === 'buy_eth' && priceDelta < 0) {
        const loss = Math.abs(priceDelta / blocked.price) * blocked.analysis.amountUSD;
        stats.losses_prevented += loss;
      } else if (blocked.analysis.direction === 'sell_eth' && priceDelta > 0) {
        const loss = Math.abs(priceDelta / blocked.price) * blocked.analysis.amountUSD;
        stats.losses_prevented += loss;
      }
    } catch {}
  }

  // Print final report
  console.log('\n' + '='.repeat(60));
  console.log('  TREASURYCLAW DEMO COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Cycles: ${CYCLES} | Duration: ${duration}s`);
  console.log(`  Executed: ${stats.executed} | Blocked: ${stats.blocked} | Approval: ${stats.approvalRequired} | Failed: ${stats.failed}`);
  console.log(`  Proposed Volume: $${stats.totalVolume.toFixed(2)} (${DEMO_CHAIN}, swap mocked)`);
  if (stats.losses_prevented > 0) {
    console.log(`  Losses Prevented: $${stats.losses_prevented.toFixed(2)}`);
  }
  console.log(`  On-chain Receipts: ${stats.receiptHashes.length}`);
  console.log(`  Mock Swap References: ${stats.mockSwapReferences.length}`);
  console.log('');
  console.log(`  Dashboard: ${process.env.DASHCLAW_BASE_URL}/agents/treasury-claw-fleet`);
  console.log(`  Replay any decision: ${process.env.DASHCLAW_BASE_URL}/replay/<action_id>`);
  if (stats.mockSwapReferences.length > 0) {
    console.log(`  Latest Mock Swap Ref: ${stats.mockSwapReferences[stats.mockSwapReferences.length - 1]}`);
  }
  if (stats.receiptHashes.length > 0) {
    console.log(`  Latest Receipt TX: https://etherscan.io/tx/${stats.receiptHashes[stats.receiptHashes.length - 1]}`);
  }
  console.log('='.repeat(60));

  // Send final summary to DashClaw
  await dc.sendMessage({
    to: 'dashboard',
    type: 'report',
    subject: `Demo complete: ${CYCLES} cycles in ${duration}s`,
    body: `Mocked swaps: ${stats.executed} | Blocked: ${stats.blocked} | Proposed volume: $${stats.totalVolume.toFixed(2)} | Receipts: ${stats.receiptHashes.length}`,
  }).catch(() => {});

  // Final handoff
  await dc.createHandoff({
    sessionDate: new Date().toISOString().slice(0, 10),
    summary: `Demo complete: ${stats.executed} mocked swaps, ${stats.blocked} blocked, ${stats.receiptHashes.length} on-chain receipts`,
    openTasks: [],
    decisions: [`Ran ${CYCLES} cycles on ${DEMO_CHAIN} with mocked swap execution`, `${stats.receiptHashes.length} decision receipts on-chain`],
  });

  await dc.heartbeat('idle');
  process.exit(0);
}

main();
