/**
 * TreasuryClaw — Treasury Agent Loop
 *
 * 3 OpenClaw agents governed by DashClaw, executing Uniswap V3 swaps.
 *
 * Flow:
 *   Agent 1 (Monitor) → read treasury balance
 *   Agent 2 (Decide)  → check lessons → Venice LLM private analysis → scan output → propose swap
 *   DashClaw           → guard check (with learning context) + human approval + signed receipt
 *   Uniswap            → execute swap via Trading API
 *   Agent 3 (Report)   → log receipt + feedback + message → new balance
 *
 * DashClaw v2.5.0 integration: 17 of 45 methods used.
 */

import { DashClaw } from 'dashclaw';
import { executeUniswapSwap, checkApproval, getQuote } from './uniswap-swap.js';
import config from '../dashclaw-config.json' assert { type: 'json' };

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// DashClaw client (v2 — 3 params only)
// ---------------------------------------------------------------------------
const dc = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: config.agentId,
});

const DASHCLAW_ACTION_TYPE = 'api';
const TREASURY_OPERATION = 'uniswap_swap';

// ---------------------------------------------------------------------------
// Module-level state for handoffs
// ---------------------------------------------------------------------------
let cycleCount = 0;
let lastBalance = null;

// ---------------------------------------------------------------------------
// Agent stubs — replace with your real OpenClaw agent calls
// ---------------------------------------------------------------------------

/**
 * Agent 1: Monitor — reads the treasury wallet balance.
 */
async function agentMonitor() {
  console.log('[Monitor] Reading treasury balance...');

  // TODO: Replace with real onchain balance read via OpenClaw tool
  const balance = {
    wallet: process.env.TREASURY_WALLET,
    totalUSD: 5000,
    positions: [
      { token: 'USDC', amount: '3000', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      { token: 'WETH', amount: '0.8', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    ],
  };

  console.log(`[Monitor] Treasury TVL: $${balance.totalUSD}`);
  lastBalance = balance.totalUSD;
  return balance;
}

/**
 * Agent 2: Decide — asks Venice LLM (private, no-retention) for rebalance advice.
 */
async function agentDecide(balance) {
  console.log('[Decide] Asking Venice for rebalance analysis (private inference)...');

  // Check DashClaw for lessons from past swap outcomes
  let lessonContext = '';
  try {
    const { lessons } = await dc.getLessons({ actionType: DASHCLAW_ACTION_TYPE });
    if (lessons.length > 0) {
      const topLesson = lessons[0];
      console.log(`[Decide] DashClaw lesson (confidence ${topLesson.confidence}): ${topLesson.guidance}`);
      lessonContext = `\nPast performance insights: ${topLesson.guidance}`;
      if (topLesson.hints.risk_cap) {
        console.log(`[Decide] Recommended risk cap: ${topLesson.hints.risk_cap}`);
      }
    }
  } catch {
    // Lessons are best-effort — don't block the cycle
  }

  // TODO: Replace with real Venice LLM call via OpenClaw
  // Include lessonContext in the prompt so Venice factors in DashClaw's learned patterns:
  // const proposal = await fleet.decide.callLLM(`
  //   Treasury balance: ${JSON.stringify(balance)}.
  //   ${lessonContext}
  //   Suggest safe rebalance (max ${process.env.MAX_SWAP_PERCENT}% TVL).
  //   Return JSON only: { actionType, goal, amountUSD, tokenIn, tokenInAddress, tokenOut, tokenOutAddress, riskScore }
  // `);

  const maxSwapUSD = balance.totalUSD * (parseInt(process.env.MAX_SWAP_PERCENT || '10', 10) / 100);
  const proposal = {
    actionType: DASHCLAW_ACTION_TYPE,
    operation: TREASURY_OPERATION,
    goal: `Rebalance treasury: swap USDC to WETH to increase ETH exposure (max $${maxSwapUSD})`,
    amountUSD: Math.min(500, maxSwapUSD),
    tokenIn: 'USDC',
    tokenInAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    tokenOut: 'WETH',
    tokenOutAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    riskScore: 25,
    chainId: 1,
  };

  // Scan Venice LLM output for injection attacks
  try {
    const scan = await dc.scanPromptInjection(JSON.stringify(proposal), { source: 'llm_output' });
    if (scan.recommendation === 'block') {
      console.log('[Decide] BLOCKED: Prompt injection detected in Venice output');
      return null;
    }
    if (scan.recommendation === 'warn') {
      console.log(`[Decide] WARNING: Suspicious Venice output (risk: ${scan.risk_level})`);
    }
  } catch {
    // Scan is best-effort
  }

  console.log(`[Decide] Proposal: swap $${proposal.amountUSD} ${proposal.tokenIn} -> ${proposal.tokenOut}`);

  // Track the assumptions Venice made during analysis
  await dc.recordAssumption({
    assumption: `${proposal.tokenIn}->${proposal.tokenOut} rebalance is optimal at current prices`,
    category: 'market_analysis',
    confidence: 70,
  });

  return proposal;
}

/**
 * Agent 3: Report — logs the receipt and updated balance.
 */
async function agentReport(actionId, outcome) {
  console.log('[Report] Publishing receipt...');

  const replayUrl = `${process.env.DASHCLAW_BASE_URL}/replay/${actionId}`;
  console.log(`[Report] Receipt: ${replayUrl}`);
  console.log(`[Report] Status: ${outcome.status}`);
  console.log(`[Report] New balance: $${outcome.newBalanceUSD || 'unknown'}`);

  return { replayUrl, outcome };
}

// ---------------------------------------------------------------------------
// Main treasury loop
// ---------------------------------------------------------------------------
async function runTreasuryLoop() {
  let action;
  let threadId;
  cycleCount++;

  try {
    // Heartbeat — report health on every cycle
    await dc.heartbeat('online', { cycle: cycleCount, interval_ms: INTERVAL_MS });

    // Start a reasoning thread for this cycle
    try {
      const { thread } = await dc.createThread({
        name: `Treasury cycle ${cycleCount}`,
        summary: `Evaluate and execute treasury rebalance — cycle ${cycleCount}`,
      });
      threadId = thread?.thread_id;
    } catch {
      // Thread creation is best-effort
    }

    // Step 1: Monitor — read balance
    const balance = await agentMonitor();
    if (threadId) await dc.addThreadEntry(threadId, `Treasury TVL: $${balance.totalUSD}`, 'observation').catch(() => {});

    // Step 2: Decide — Venice LLM proposes action (with lessons + injection scan)
    const proposal = await agentDecide(balance);
    if (!proposal) {
      if (threadId) await dc.closeThread(threadId, 'Cycle skipped — Venice output blocked by injection scan').catch(() => {});
      return;
    }
    if (threadId) await dc.addThreadEntry(threadId, `Proposal: swap $${proposal.amountUSD} ${proposal.tokenIn} → ${proposal.tokenOut}`, 'decision').catch(() => {});

    // Step 3: DashClaw guard check (now includes learning context)
    const guardResult = await dc.guard({
      actionType: proposal.actionType,
      riskScore: proposal.riskScore,
      content: JSON.stringify({
        ...proposal,
        operation: proposal.operation || TREASURY_OPERATION,
        chain: 'sepolia',
        approvalContext: 'TreasuryClaw governed Uniswap rebalance',
      }),
    });

    if (guardResult.decision === 'block') {
      console.log(`[Guard] BLOCKED: ${guardResult.reason || 'Policy violation'}`);
      if (threadId) await dc.closeThread(threadId, `Blocked by guard: ${guardResult.reason || 'policy violation'}`).catch(() => {});
      return;
    }

    // React to learning context from guard
    if (guardResult.learning) {
      const lc = guardResult.learning;
      if (lc.recent_score_avg !== null && lc.recent_score_avg < 50) {
        console.log(`[Guard] WARNING: Recent swap quality is low (avg score: ${lc.recent_score_avg})`);
      }
      if (lc.drift_status === 'critical') {
        console.log('[Guard] CRITICAL: Behavioral drift detected — proceeding with caution');
      }
      if (lc.feedback_summary) {
        console.log(`[Guard] Feedback: ${lc.feedback_summary}`);
      }
    }

    console.log(`[Guard] Allowed (risk: ${proposal.riskScore})`);
    if (threadId) await dc.addThreadEntry(threadId, `Guard: ${guardResult.decision} (risk: ${proposal.riskScore})`, 'observation').catch(() => {});

    // Step 4: Create verifiable action record
    action = await dc.createAction({
      actionType: proposal.actionType,
      declaredGoal: `${proposal.goal}. Operation=${proposal.operation || TREASURY_OPERATION}. Chain=sepolia. Tokens=${proposal.tokenIn}->${proposal.tokenOut}. AmountUSD=${proposal.amountUSD}`,
      riskScore: proposal.riskScore,
      metadata: {
        operation: proposal.operation || TREASURY_OPERATION,
        chain: 'sepolia',
        tokenIn: proposal.tokenIn,
        tokenOut: proposal.tokenOut,
        amountUSD: proposal.amountUSD,
        treasuryTVL: balance.totalUSD,
      },
    });

    console.log(`[DashClaw] Action created: ${action.action_id}`);

    // Step 5: Wait for human approval (if required by policy)
    if (guardResult.requiresApproval) {
      console.log('[DashClaw] Waiting for human approval...');
      console.log(`[DashClaw] Approve at: ${process.env.DASHCLAW_BASE_URL}/actions/${action.action_id}`);
      await dc.waitForApproval(action.action_id, { timeout: 10 * 60 * 1000 });
      console.log('[DashClaw] Approved!');
    }

    // Step 6: Execute Uniswap swap
    console.log('[Swap] Executing Uniswap V3 swap...');

    const tokenInAmount = convertToTokenAmount(proposal.tokenIn, proposal.amountUSD);

    const approvalTx = await checkApproval(
      process.env.TREASURY_WALLET,
      proposal.tokenInAddress,
      tokenInAmount,
      proposal.chainId,
    );
    if (approvalTx) {
      console.log('[Swap] Token approval needed — submitting approval tx...');
      // TODO: Sign and send approvalTx with your wallet
    }

    const quote = await getQuote({
      swapper: process.env.TREASURY_WALLET,
      tokenIn: proposal.tokenInAddress,
      tokenOut: proposal.tokenOutAddress,
      chainId: proposal.chainId,
      amount: tokenInAmount,
    });

    const txHash = await executeUniswapSwap(quote);
    console.log(`[Swap] Tx: ${txHash}`);
    if (threadId) await dc.addThreadEntry(threadId, `Executed: tx ${txHash}`, 'observation').catch(() => {});

    // Step 7: Record outcome in DashClaw
    await dc.updateOutcome(action.action_id, {
      status: 'completed',
      outputSummary: `Swapped $${proposal.amountUSD} ${proposal.tokenIn} -> ${proposal.tokenOut}. Tx: ${txHash}`,
      costEstimate: 0.005,
    });

    // Step 8: Submit feedback — auto-rate swap quality based on execution
    try {
      const slippage = quote.slippage || 0;
      const rating = slippage < 0.3 ? 5 : slippage < 0.5 ? 4 : slippage < 1.0 ? 3 : 2;
      await dc.submitFeedback({
        action_id: action.action_id,
        rating,
        comment: `Swap executed. Slippage: ${slippage}%. Tx: ${txHash}`,
        category: 'execution_quality',
      });
    } catch {
      // Feedback is best-effort
    }

    // Step 9: Report
    const newBalance = await agentMonitor();
    await agentReport(action.action_id, {
      status: 'completed',
      txHash,
      newBalanceUSD: newBalance.totalUSD,
    });

    // Step 10: Send status message to dashboard
    try {
      await dc.sendMessage({
        to: 'dashboard',
        type: 'status',
        subject: `Cycle ${cycleCount} complete`,
        body: `Swapped $${proposal.amountUSD} ${proposal.tokenIn} → ${proposal.tokenOut}. TVL: $${newBalance.totalUSD}. Tx: ${txHash}`,
      });
    } catch {
      // Messaging is best-effort
    }

    // Close the reasoning thread
    if (threadId) {
      await dc.closeThread(threadId, `Cycle ${cycleCount} complete. Swapped $${proposal.amountUSD} ${proposal.tokenIn} → ${proposal.tokenOut}`).catch(() => {});
    }

    console.log(`\n[TreasuryClaw] Cycle ${cycleCount} complete. Receipt: ${action.action_id}\n`);
  } catch (err) {
    console.error('[TreasuryClaw] Error:', err.message);

    if (action) {
      await dc.updateOutcome(action.action_id, {
        status: 'failed',
        outputSummary: err.message,
      });
    }

    if (threadId) {
      await dc.closeThread(threadId, `Cycle ${cycleCount} failed: ${err.message}`).catch(() => {});
    }
  }
}

/**
 * Convert a USD amount to the token's smallest unit.
 * In production, fetch real prices from an oracle or the quote endpoint.
 */
function convertToTokenAmount(token, amountUSD) {
  if (token === 'USDC' || token === 'USDT') {
    return String(Math.floor(amountUSD * 1e6));
  }
  if (token === 'WETH') {
    const ethPrice = 3000;
    const ethAmount = amountUSD / ethPrice;
    return String(Math.floor(ethAmount * 1e18));
  }
  return String(Math.floor(amountUSD * 1e18));
}

// ---------------------------------------------------------------------------
// Startup + Graceful Shutdown
// ---------------------------------------------------------------------------
const INTERVAL_MS = parseInt(process.env.LOOP_INTERVAL_MS || '300000', 10);

async function shutdown() {
  console.log('\n[TreasuryClaw] Shutting down...');
  try {
    await dc.createHandoff({
      sessionDate: new Date().toISOString().slice(0, 10),
      summary: `Ran ${cycleCount} cycles. Last balance: $${lastBalance || 'unknown'}`,
      openTasks: ['Verify pending swaps completed on-chain'],
      decisions: [`Completed ${cycleCount} rebalance cycles`],
    });
    await dc.heartbeat('offline');
  } catch (err) {
    console.error('[Handoff] Failed:', err.message);
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function startup() {
  console.log('=== TreasuryClaw ===');
  console.log(`Agent fleet: ${config.agentId}`);
  console.log(`Loop interval: ${INTERVAL_MS / 1000}s`);
  console.log('');

  // Resume from last session
  try {
    const { handoff } = await dc.getLatestHandoff();
    if (handoff) {
      console.log(`[Handoff] Resuming from: ${handoff.summary}`);
      if (handoff.openTasks?.length) {
        console.log(`[Handoff] Open tasks: ${handoff.openTasks.join(', ')}`);
      }
    }
  } catch {
    // No previous handoff — first run
  }

  // Report external connections to DashClaw
  await dc.reportConnections([
    { name: 'Uniswap Trading API', type: 'api', status: 'connected' },
    { name: 'Venice LLM', type: 'llm', status: 'connected' },
    { name: 'Ethereum RPC', type: 'rpc', status: 'connected' },
  ]);

  // Run immediately, then on interval
  runTreasuryLoop();
  setInterval(runTreasuryLoop, INTERVAL_MS);
}

startup();
