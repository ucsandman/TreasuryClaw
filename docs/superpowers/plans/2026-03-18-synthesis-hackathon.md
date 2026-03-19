# Synthesis Hackathon — TreasuryClaw x DashClaw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working, on-chain, governed treasury agent for the Synthesis hackathon — ERC-8004 identity on Base, real Uniswap V3 swaps on Sepolia, DashClaw governance with learning loop, all verifiable on-chain. Due March 22.

**Architecture:** TreasuryClaw registers its on-chain identity via ERC-8004 on Base Mainnet, fetches real ETH/USD prices from 4 free APIs, computes portfolio rebalance proposals, gets governed by DashClaw (guard + approval + learning), executes real Uniswap V3 swaps on Sepolia testnet, and writes decision receipt hashes on-chain. Every action is replayable via DashClaw and verifiable on Etherscan.

**Tech Stack:** Node.js ESM, viem (already a dependency), erc-8004-js SDK, DashClaw v2.5.0 SDK, Uniswap V3 SwapRouter on Sepolia, free price APIs (Binance, Coinbase, DeFi Llama, CryptoCompare).

**Deadline:** March 22, 2026 (4 days from now)

---

## Contract Addresses

**ERC-8004 on Base Mainnet (chain 8453):**
- Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

**Uniswap V3 on Sepolia (chain 11155111):**
- SwapRouter02: `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`
- QuoterV2: `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3`
- WETH: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`
- USDC (Circle): `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

---

## File Map

| File | Task | Purpose |
|------|------|---------|
| `src/price-feed.js` | 1 | Round-robin multi-source ETH/USD price fetcher |
| `src/market-analyzer.js` | 2 | Portfolio analysis + proposal generation from real prices |
| `src/sepolia-swap.js` | 3 | Real Uniswap V3 swaps on Sepolia testnet |
| `src/erc8004.js` | 4 | ERC-8004 agent identity registration on Base |
| `src/onchain-receipts.js` | 5 | Write governance decision hashes to Sepolia |
| `src/demo.js` | 6 | Demo runner — orchestrates N live cycles |
| `src/treasury-agent.js` | 6 | Modify — wire new modules into existing loop |
| `package.json` | 1 | Add erc-8004-js dependency |
| `.env.example` | 3 | Add Sepolia + Base env vars |
| `README.md` | 7 | Hackathon submission docs + setup instructions |

---

### Task 1: Price Feed

**Files:**
- Create: `src/price-feed.js`
- Modify: `package.json`

- [ ] **Step 1: Create the price feed module**

```javascript
// src/price-feed.js
const SOURCES = [
  {
    name: 'Binance',
    url: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
    parse: (data) => parseFloat(data.price),
  },
  {
    name: 'Coinbase',
    url: 'https://api.coinbase.com/v2/prices/ETH-USD/spot',
    parse: (data) => parseFloat(data.data.amount),
  },
  {
    name: 'DeFi Llama',
    url: 'https://coins.llama.fi/prices/current/coingecko:ethereum',
    parse: (data) => data.coins['coingecko:ethereum'].price,
  },
  {
    name: 'CryptoCompare',
    url: 'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',
    parse: (data) => data.USD,
  },
];

let sourceIndex = 0;

export async function getEthPrice() {
  const errors = [];
  for (let attempt = 0; attempt < SOURCES.length; attempt++) {
    const source = SOURCES[(sourceIndex + attempt) % SOURCES.length];
    try {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const price = source.parse(data);
      if (!price || isNaN(price)) throw new Error('Invalid price');
      sourceIndex = (sourceIndex + attempt + 1) % SOURCES.length;
      return { price, source: source.name, timestamp: Date.now() };
    } catch (err) {
      errors.push(`${source.name}: ${err.message}`);
    }
  }
  throw new Error(`All price sources failed: ${errors.join(', ')}`);
}

export async function getMedianEthPrice() {
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      return source.parse(data);
    })
  );
  const prices = results.filter(r => r.status === 'fulfilled').map(r => r.value).filter(p => p && !isNaN(p));
  if (prices.length === 0) throw new Error('No price sources available');
  prices.sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  return { price: median, sources: prices.length, timestamp: Date.now() };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/price-feed.js
git commit -m "feat: add multi-source ETH/USD price feed with round-robin and median"
```

---

### Task 2: Market Analyzer

**Files:**
- Create: `src/market-analyzer.js`

- [ ] **Step 1: Create the market analyzer**

```javascript
// src/market-analyzer.js

const TARGET_ETH_ALLOCATION = 0.50; // 50/50 USDC/ETH target
const REBALANCE_THRESHOLD = 0.05;   // Rebalance when >5% off target

export function analyzePortfolio(balance, ethPrice) {
  const ethValue = parseFloat(balance.positions.find(p => p.token === 'WETH')?.amount || 0) * ethPrice;
  const usdcValue = parseFloat(balance.positions.find(p => p.token === 'USDC')?.amount || 0);
  const totalUSD = ethValue + usdcValue;

  if (totalUSD === 0) return { rebalanceNeeded: false, direction: 'hold', amountUSD: 0, riskScore: 0, confidence: 0 };

  const currentEthAllocation = ethValue / totalUSD;
  const deviation = currentEthAllocation - TARGET_ETH_ALLOCATION;
  const rebalanceNeeded = Math.abs(deviation) > REBALANCE_THRESHOLD;

  let direction = 'hold';
  let amountUSD = 0;
  if (deviation < -REBALANCE_THRESHOLD) {
    direction = 'buy_eth';
    amountUSD = Math.abs(deviation) * totalUSD * 0.5; // Rebalance half the deviation
  } else if (deviation > REBALANCE_THRESHOLD) {
    direction = 'sell_eth';
    amountUSD = Math.abs(deviation) * totalUSD * 0.5;
  }

  // Cap at 10% of TVL per swap
  const maxSwap = totalUSD * 0.10;
  amountUSD = Math.min(amountUSD, maxSwap);

  // Risk scoring
  let riskScore = 20; // Base: routine treasury op
  if (amountUSD > totalUSD * 0.05) riskScore += 10;
  if (amountUSD > totalUSD * 0.08) riskScore += 15;
  if (Math.abs(deviation) > 0.15) riskScore += 10; // Portfolio very unbalanced
  riskScore = Math.min(riskScore, 95);

  const confidence = Math.min(90, 50 + (totalUSD > 1000 ? 20 : 0) + (Math.abs(deviation) > 0.1 ? 15 : 0));

  return {
    currentEthAllocation: Math.round(currentEthAllocation * 100),
    targetEthAllocation: Math.round(TARGET_ETH_ALLOCATION * 100),
    deviation: Math.round(deviation * 100),
    rebalanceNeeded,
    direction,
    amountUSD: Math.round(amountUSD * 100) / 100,
    riskScore,
    confidence,
    ethPrice,
    totalUSD: Math.round(totalUSD * 100) / 100,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/market-analyzer.js
git commit -m "feat: add market analyzer with real portfolio math and risk scoring"
```

---

### Task 3: Sepolia Swap Executor

**Files:**
- Create: `src/sepolia-swap.js`
- Modify: `.env.example`

- [ ] **Step 1: Create the Sepolia swap module**

Uses viem (already a dependency) to execute real Uniswap V3 swaps on Sepolia:

```javascript
// src/sepolia-swap.js
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const SWAP_ROUTER = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E';
const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const POOL_FEE = 3000; // 0.3% fee tier

// Minimal ABIs for swap
const ERC20_ABI = [
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
];

const SWAP_ROUTER_ABI = [
  { name: 'exactInputSingle', type: 'function', inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
    { name: 'fee', type: 'uint24' }, { name: 'recipient', type: 'address' },
    { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' },
    { name: 'sqrtPriceLimitX96', type: 'uint160' },
  ]}], outputs: [{ type: 'uint256' }], stateMutability: 'payable' },
];

export function createSepoliaClients() {
  const account = privateKeyToAccount(process.env.SEPOLIA_PRIVATE_KEY);
  const transport = http(process.env.SEPOLIA_RPC_URL);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });
  return { publicClient, walletClient, account };
}

export async function getSepoliaBalance(address) {
  const { publicClient } = createSepoliaClients();
  const [ethBalance, usdcBalance, wethBalance] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
    publicClient.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
  ]);
  return {
    wallet: address,
    ethBalance: formatUnits(ethBalance, 18),
    positions: [
      { token: 'USDC', amount: formatUnits(usdcBalance, 6), address: USDC },
      { token: 'WETH', amount: formatUnits(wethBalance, 18), address: WETH },
    ],
  };
}

export async function executeSepoliaSwap({ direction, amountUSD, ethPrice }) {
  const { publicClient, walletClient, account } = createSepoliaClients();

  const tokenIn = direction === 'buy_eth' ? USDC : WETH;
  const tokenOut = direction === 'buy_eth' ? WETH : USDC;
  const decimalsIn = direction === 'buy_eth' ? 6 : 18;
  const amountIn = direction === 'buy_eth'
    ? parseUnits(String(amountUSD), 6)
    : parseUnits(String(amountUSD / ethPrice), 18);

  // Approve router to spend tokens
  const allowance = await publicClient.readContract({
    address: tokenIn, abi: ERC20_ABI, functionName: 'allowance',
    args: [account.address, SWAP_ROUTER],
  });
  if (allowance < amountIn) {
    const approveTx = await walletClient.writeContract({
      address: tokenIn, abi: ERC20_ABI, functionName: 'approve',
      args: [SWAP_ROUTER, amountIn * 2n],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  // Execute swap
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const txHash = await walletClient.writeContract({
    address: SWAP_ROUTER,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn, tokenOut, fee: POOL_FEE,
      recipient: account.address,
      amountIn,
      amountOutMinimum: 0n, // Accept any amount (testnet)
      sqrtPriceLimitX96: 0n,
    }],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    gasUsed: receipt.gasUsed.toString(),
    status: receipt.status === 'success' ? 'completed' : 'failed',
    blockNumber: receipt.blockNumber.toString(),
    explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
  };
}
```

- [ ] **Step 2: Update .env.example**

Add to `.env.example`:
```bash
# Sepolia Testnet
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_free_key
SEPOLIA_PRIVATE_KEY=0x_your_sepolia_test_wallet_private_key

# Base Mainnet (for ERC-8004 registration)
BASE_RPC_URL=https://mainnet.base.org
BASE_PRIVATE_KEY=0x_your_base_wallet_private_key
```

- [ ] **Step 3: Commit**

```bash
git add src/sepolia-swap.js .env.example
git commit -m "feat: add real Uniswap V3 swap executor on Sepolia testnet"
```

---

### Task 4: ERC-8004 Agent Identity on Base

**Files:**
- Create: `src/erc8004.js`
- Modify: `package.json`

- [ ] **Step 1: Install erc-8004-js**

```bash
cd "C:/Projects/TreasuryClaw" && npm install erc-8004-js
```

- [ ] **Step 2: Create the ERC-8004 module**

```javascript
// src/erc8004.js
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';

// Minimal ABI for identity registration and reputation
const IDENTITY_ABI = [
  { name: 'register', type: 'function', inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ name: 'agentId', type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'ownerOf', type: 'function', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'tokenURI', type: 'function', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];

const REPUTATION_ABI = [
  { name: 'giveFeedback', type: 'function', inputs: [
    { name: 'agentId', type: 'uint256' }, { name: 'value', type: 'int128' },
    { name: 'valueDecimals', type: 'uint8' }, { name: 'tag1', type: 'string' },
    { name: 'tag2', type: 'string' }, { name: 'endpoint', type: 'string' },
    { name: 'feedbackURI', type: 'string' }, { name: 'feedbackHash', type: 'bytes32' },
  ], outputs: [], stateMutability: 'nonpayable' },
];

function createBaseClients() {
  const account = privateKeyToAccount(process.env.BASE_PRIVATE_KEY);
  const transport = http(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({ account, chain: base, transport });
  return { publicClient, walletClient, account };
}

/**
 * Register TreasuryClaw as an ERC-8004 agent on Base Mainnet.
 * The agentURI points to metadata about the agent.
 */
export async function registerAgent(agentURI) {
  const { publicClient, walletClient } = createBaseClients();

  const txHash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`[ERC-8004] Agent registered on Base: https://basescan.org/tx/${txHash}`);

  // Extract agentId from logs (Transfer event, tokenId)
  const agentId = receipt.logs[0]?.topics[3]
    ? BigInt(receipt.logs[0].topics[3]).toString()
    : null;

  return { txHash, agentId, explorerUrl: `https://basescan.org/tx/${txHash}` };
}

/**
 * Check if wallet already has a registered agent.
 */
export async function getAgentCount() {
  const { publicClient, account } = createBaseClients();
  const count = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  return Number(count);
}

/**
 * Submit on-chain reputation feedback for an agent.
 */
export async function submitOnChainFeedback(agentId, score, tag, feedbackURI) {
  const { publicClient, walletClient } = createBaseClients();

  const txHash = await walletClient.writeContract({
    address: REPUTATION_REGISTRY,
    abi: REPUTATION_ABI,
    functionName: 'giveFeedback',
    args: [
      BigInt(agentId),
      BigInt(Math.round(score * 100)), // int128 with 2 decimals
      2,                                // valueDecimals
      tag || 'governance',
      'treasury',
      '',                               // endpoint
      feedbackURI || '',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash, explorerUrl: `https://basescan.org/tx/${txHash}` };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/erc8004.js package.json package-lock.json
git commit -m "feat: add ERC-8004 agent identity registration on Base Mainnet"
```

---

### Task 5: On-Chain Decision Receipts

**Files:**
- Create: `src/onchain-receipts.js`

- [ ] **Step 1: Create the receipt writer**

Stores a hash of each governance decision on Sepolia. Uses a simple self-transaction with calldata — no contract deployment needed:

```javascript
// src/onchain-receipts.js
import { createPublicClient, createWalletClient, http, toHex, keccak256, toBytes } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Write a governance decision receipt hash to Sepolia.
 * Uses a 0-value self-transaction with the receipt hash as calldata.
 * Costs only gas (~21,000 + calldata gas). Verifiable on Etherscan.
 */
export async function writeDecisionReceipt(decision) {
  const account = privateKeyToAccount(process.env.SEPOLIA_PRIVATE_KEY);
  const transport = http(process.env.SEPOLIA_RPC_URL);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  // Build receipt payload
  const receipt = {
    agent_id: decision.agent_id,
    action_id: decision.action_id,
    action_type: decision.action_type,
    guard_decision: decision.guard_decision,
    risk_score: decision.risk_score,
    outcome: decision.outcome,
    timestamp: new Date().toISOString(),
    dashclaw_replay: decision.replay_url,
  };

  const receiptJson = JSON.stringify(receipt);
  const receiptHash = keccak256(toBytes(receiptJson));

  // Write hash as calldata in a self-transaction
  const txHash = await walletClient.sendTransaction({
    to: account.address,
    value: 0n,
    data: receiptHash,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    receiptHash,
    explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
    receipt,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/onchain-receipts.js
git commit -m "feat: add on-chain decision receipt writer (Sepolia)"
```

---

### Task 6: Demo Runner — The Full Live Demo

**Files:**
- Create: `src/demo.js`
- Modify: `src/treasury-agent.js`

- [ ] **Step 1: Create the demo runner**

This is the main event — orchestrates N live cycles with real prices, real swaps, real governance, real on-chain receipts:

```javascript
// src/demo.js
import { DashClaw } from 'dashclaw';
import { getEthPrice, getMedianEthPrice } from './price-feed.js';
import { analyzePortfolio } from './market-analyzer.js';
import { getSepoliaBalance, executeSepoliaSwap, createSepoliaClients } from './sepolia-swap.js';
import { registerAgent, getAgentCount, submitOnChainFeedback } from './erc8004.js';
import { writeDecisionReceipt } from './onchain-receipts.js';
import config from '../dashclaw-config.json' assert { type: 'json' };

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

// Stats tracking
const stats = {
  executed: 0, blocked: 0, approvalRequired: 0, failed: 0,
  totalVolume: 0, losses_prevented: 0,
  txHashes: [], receiptHashes: [], blockedProposals: [],
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
        summary: `Live treasury rebalance — cycle ${cycle} of ${CYCLES}`,
      });
      threadId = thread?.thread_id;
    } catch {}

    // 1. Read real Sepolia balance
    const { account } = createSepoliaClients();
    const balance = await getSepoliaBalance(account.address);
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
      const { lessons } = await dc.getLessons({ actionType: 'uniswap_swap' });
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
      actionType: 'uniswap_swap',
      riskScore: analysis.riskScore,
      content: JSON.stringify(analysis),
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
      actionType: 'uniswap_swap',
      declaredGoal: `${analysis.direction}: $${analysis.amountUSD} at ETH=$${priceData.price.toFixed(2)}`,
      riskScore: analysis.riskScore,
      metadata: { ...analysis, ethPrice: priceData.price, source: priceData.source },
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

    // 9. Execute REAL Uniswap swap on Sepolia
    console.log('[Swap] Executing on Sepolia...');
    const swapResult = await executeSepoliaSwap({
      direction: analysis.direction,
      amountUSD: analysis.amountUSD,
      ethPrice: priceData.price,
    });
    console.log(`[Swap] TX: ${swapResult.explorerUrl}`);
    stats.txHashes.push(swapResult.txHash);
    stats.executed++;
    stats.totalVolume += analysis.amountUSD;

    if (threadId) await dc.addThreadEntry(threadId, `Executed: ${swapResult.explorerUrl}`, 'observation').catch(() => {});

    // 10. Record outcome
    await dc.updateOutcome(action.action_id, {
      status: swapResult.status,
      outputSummary: `${analysis.direction} $${analysis.amountUSD} on Sepolia. TX: ${swapResult.txHash}`,
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
        outcome: swapResult.status,
        replay_url: `${process.env.DASHCLAW_BASE_URL}/replay/${action.action_id}`,
      });
      console.log(`[Receipt] On-chain: ${receiptResult.explorerUrl}`);
      stats.receiptHashes.push(receiptResult.txHash);
    } catch (err) {
      console.log(`[Receipt] Skipped: ${err.message}`);
    }

    // 12. Submit feedback
    const rating = swapResult.status === 'completed' ? (analysis.riskScore < 30 ? 5 : analysis.riskScore < 50 ? 4 : 3) : 1;
    await dc.submitFeedback({
      action_id: action.action_id,
      rating,
      comment: `Cycle ${cycle}: ${analysis.direction} $${analysis.amountUSD}. TX: ${swapResult.txHash}`,
      category: 'execution_quality',
    }).catch(() => {});

    // 13. Send status message
    await dc.sendMessage({
      to: 'dashboard',
      type: 'status',
      subject: `Cycle ${cycle}: ${analysis.direction} $${analysis.amountUSD}`,
      body: `ETH=$${priceData.price.toFixed(2)} | Risk: ${analysis.riskScore} | TX: ${swapResult.explorerUrl}`,
    }).catch(() => {});

    // 14. Close thread
    if (threadId) await dc.closeThread(threadId, `Cycle ${cycle} complete: ${swapResult.explorerUrl}`).catch(() => {});

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
  console.log('  TREASURYCLAW LIVE DEMO');
  console.log('  Real prices. Real swaps. Real governance. Real blockchain.');
  console.log('='.repeat(60));
  console.log(`Cycles: ${CYCLES} | Delay: ${DELAY}ms | Auto-approve: ${AUTO_APPROVE}`);
  console.log(`DashClaw: ${process.env.DASHCLAW_BASE_URL}`);
  console.log('');

  // ERC-8004: Register agent identity on Base (if not already registered)
  try {
    const count = await getAgentCount();
    if (count === 0) {
      console.log('[ERC-8004] Registering agent identity on Base Mainnet...');
      const reg = await registerAgent(
        `https://github.com/ucsandman/TreasuryClaw`
      );
      console.log(`[ERC-8004] Registered! Agent ID: ${reg.agentId}`);
      console.log(`[ERC-8004] BaseScan: ${reg.explorerUrl}`);
    } else {
      console.log(`[ERC-8004] Agent already registered on Base (${count} identity/ies)`);
    }
  } catch (err) {
    console.log(`[ERC-8004] Registration skipped: ${err.message}`);
  }

  // Report connections
  await dc.reportConnections([
    { name: 'Uniswap V3 (Sepolia)', type: 'dex', status: 'connected' },
    { name: 'Multi-source Price Feed', type: 'oracle', status: 'connected' },
    { name: 'ERC-8004 Identity (Base)', type: 'identity', status: 'connected' },
    { name: 'Sepolia Testnet', type: 'blockchain', status: 'connected' },
  ]);

  // Create session handoff
  await dc.createHandoff({
    sessionDate: new Date().toISOString().slice(0, 10),
    summary: `Starting live demo: ${CYCLES} cycles on Sepolia with real prices`,
    openTasks: [`Execute ${CYCLES} governed treasury cycles`],
    decisions: ['Using Sepolia testnet', 'Real price feeds', 'ERC-8004 identity on Base'],
  });

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
  console.log(`  Total Volume: $${stats.totalVolume.toFixed(2)} (Sepolia testnet)`);
  if (stats.losses_prevented > 0) {
    console.log(`  Losses Prevented: $${stats.losses_prevented.toFixed(2)}`);
  }
  console.log(`  On-chain Receipts: ${stats.receiptHashes.length}`);
  console.log(`  Swap Transactions: ${stats.txHashes.length}`);
  console.log('');
  console.log(`  Dashboard: ${process.env.DASHCLAW_BASE_URL}/agents/treasury-claw-fleet`);
  console.log(`  Replay any decision: ${process.env.DASHCLAW_BASE_URL}/replay/<action_id>`);
  if (stats.txHashes.length > 0) {
    console.log(`  Latest Sepolia TX: https://sepolia.etherscan.io/tx/${stats.txHashes[stats.txHashes.length - 1]}`);
  }
  if (stats.receiptHashes.length > 0) {
    console.log(`  Latest Receipt TX: https://sepolia.etherscan.io/tx/${stats.receiptHashes[stats.receiptHashes.length - 1]}`);
  }
  console.log('='.repeat(60));

  // Send final summary to DashClaw
  await dc.sendMessage({
    to: 'dashboard',
    type: 'report',
    subject: `Demo complete: ${CYCLES} cycles in ${duration}s`,
    body: `Executed: ${stats.executed} | Blocked: ${stats.blocked} | Volume: $${stats.totalVolume.toFixed(2)} | Receipts: ${stats.receiptHashes.length}`,
  }).catch(() => {});

  // Final handoff
  await dc.createHandoff({
    sessionDate: new Date().toISOString().slice(0, 10),
    summary: `Demo complete: ${stats.executed} swaps, ${stats.blocked} blocked, ${stats.receiptHashes.length} on-chain receipts`,
    openTasks: [],
    decisions: [`Ran ${CYCLES} cycles on Sepolia`, `${stats.receiptHashes.length} decision receipts on-chain`],
  });

  await dc.heartbeat('idle');
  process.exit(0);
}

main();
```

- [ ] **Step 2: Commit**

```bash
git add src/demo.js
git commit -m "feat: add live demo runner — real prices, real swaps, real governance, real on-chain receipts"
```

---

### Task 7: README + Submission Docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite README for hackathon submission**

Update the README to be a compelling hackathon submission document covering:
- What TreasuryClaw is (autonomous treasury agent governed by DashClaw)
- Tracks: Agents that Pay + Agents that Trust
- On-chain artifacts: ERC-8004 on Base, Uniswap swaps on Sepolia, decision receipts on Sepolia
- Architecture diagram (text-based)
- Setup instructions (faucets, RPC, env vars)
- How to run the demo
- Partner integrations: Uniswap (swaps), Base (ERC-8004), DashClaw (governance)
- Links to repos (DashClaw + TreasuryClaw — both public)

- [ ] **Step 2: Commit and push**

```bash
git add README.md
git commit -m "docs: hackathon submission README — Synthesis March 2026"
git push origin master
```
