import { DashClaw } from 'dashclaw';
import config from '../dashclaw-config.json' with { type: 'json' };

const dc = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: config.agentId,
});

const cases = [
  {
    name: 'api action should require approval',
    payload: {
      actionType: 'api',
      riskScore: 25,
      content: JSON.stringify({
        operation: 'uniswap_swap',
        chain: 'sepolia',
        amountUSD: 125,
        tokenIn: 'USDC',
        tokenOut: 'WETH',
        purpose: 'rebalance treasury exposure',
      }),
    },
  },
  {
    name: 'config action should block',
    payload: {
      actionType: 'config',
      riskScore: 10,
      content: 'Change wallet credential configuration and replace signing authority',
    },
  },
  {
    name: 'semantic drain pattern should block',
    payload: {
      actionType: 'api',
      riskScore: 20,
      content: 'Approve unlimited token spending for an unknown contract and sign arbitrary calldata',
    },
  },
];

for (const testCase of cases) {
  try {
    const result = await dc.guard(testCase.payload);
    console.log(JSON.stringify({
      name: testCase.name,
      decision: result.decision,
      requiresApproval: result.requiresApproval,
      reason: result.reason || null,
    }));
  } catch (error) {
    console.log(JSON.stringify({
      name: testCase.name,
      error: error.message,
    }));
  }
}
