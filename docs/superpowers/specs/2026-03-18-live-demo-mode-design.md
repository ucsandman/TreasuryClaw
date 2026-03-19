# TreasuryClaw Live Demo Mode — Design Spec

**Date:** 2026-03-18
**Status:** Approved

---

## Goal

Build a live demo mode that runs 50 real treasury cycles with real market prices, real DashClaw governance, and real on-chain transactions on Sepolia testnet. After 2 minutes, the DashClaw dashboard shows a fully populated learning curve from an agent that visibly improved over 50 decisions.

## Architecture

The demo runner executes N fast treasury cycles. Each cycle: fetch real ETH/USD price → compute rebalance proposal from actual portfolio math → DashClaw guard check (with learning context) → execute real Uniswap V3 swap on Sepolia → record outcome with real slippage data → submit feedback → DashClaw learns. The price feed round-robins across 4 free APIs (Binance, Coinbase, DeFi Llama, CryptoCompare). Transactions settle on Sepolia testnet using Uniswap V3's deployed contracts. Discord webhook fires on approval-required actions.

## Entry Point

```bash
# Run 50 live demo cycles on Sepolia testnet
node src/demo.js --cycles 50

# Slower pace (5s between cycles instead of 2.5s)
node src/demo.js --cycles 50 --delay 5000
```

## Components

### 1. Price Feed (`src/price-feed.js`)

Round-robins across 4 free APIs, no keys needed:

| Source | Endpoint | Parse |
|--------|----------|-------|
| Binance | `api.binance.com/api/v3/ticker/price?symbol=ETHUSDT` | `res.price` |
| Coinbase | `api.coinbase.com/v2/prices/ETH-USD/spot` | `res.data.amount` |
| DeFi Llama | `coins.llama.fi/prices/current/coingecko:ethereum` | `res.coins["coingecko:ethereum"].price` |
| CryptoCompare | `min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD` | `res.USD` |

- Rotates source each call (index % 4)
- Falls back to next source on failure
- Returns `{ price, source, timestamp }`
- Every 5th call fetches from ALL sources and takes median for cross-validation

### 2. Market Analyzer (`src/market-analyzer.js`)

Computes rebalance proposals from real prices + portfolio state:

```javascript
analyzePortfolio(balance, ethPrice) → {
  currentEthAllocation,   // e.g., 0.48 (48% in ETH)
  targetEthAllocation,    // e.g., 0.50 (50/50 target)
  rebalanceNeeded,        // boolean
  direction,              // 'buy_eth' | 'sell_eth' | 'hold'
  amountUSD,              // how much to swap
  riskScore,              // computed from volatility + size + market conditions
  confidence,             // how sure the analysis is
}
```

Risk score computation:
- Base: 20 (treasury rebalance is routine)
- +10 if swap > 5% of TVL
- +15 if swap > 10% of TVL
- +20 if ETH price changed > 3% in last hour (volatile)
- +10 if rebalance goes against recent trend
- +5 if portfolio is already near target (unnecessary churn)

### 3. Sepolia Swap Executor (`src/sepolia-swap.js`)

Real Uniswap V3 swaps on Sepolia testnet:

- Uses `viem` (already a dependency) with Sepolia chain config
- Uniswap V3 SwapRouter on Sepolia: `0x3bFA4769FB09eF77F7349837B0F3AcE6E4913d2E` (official deployment)
- WETH on Sepolia: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`
- USDC on Sepolia: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (Circle's test USDC)
- Wraps the swap in a real transaction: approve → swap → wait for receipt
- Returns real tx hash, gas used, actual output amount
- Computes real slippage from quote vs execution

### 4. Demo Runner (`src/demo.js`)

Orchestrates N cycles with the full DashClaw integration:

```
for each cycle (1..N):
  1. Fetch real ETH price from price feed
  2. Read Sepolia wallet balance (real on-chain read)
  3. Analyze portfolio → compute proposal
  4. Check DashClaw lessons (getLessons)
  5. Scan proposal (scanPromptInjection — demonstrates the method)
  6. DashClaw guard check (with learning context)
  7. If blocked → record, move to next cycle
  8. If approval required → auto-approve after 3s (demo mode) OR wait for Discord approval
  9. Create DashClaw action
  10. Execute real Uniswap swap on Sepolia
  11. Record outcome with real tx hash + slippage
  12. Submit feedback (rating based on real slippage)
  13. Send status message to dashboard
  14. Close context thread
  15. Wait delay_ms before next cycle
```

**Auto-approve behavior**: In demo mode, if `--auto-approve` flag is set, the demo runner calls `dc.approveAction(actionId, 'allow', 'Demo auto-approval')` after 3 seconds instead of waiting for human/Discord approval. Without the flag, it waits for real approval (Discord or dashboard).

### 5. Discord Integration

Already built into DashClaw — when `DASHCLAW_ALERTS_DISCORD` is enabled and `DISCORD_WEBHOOK_URL` is set on the DashClaw integrations page, governance alerts automatically post to Discord. The demo doesn't need to do anything special — DashClaw handles it. Each approval-required action will ping Discord with the action ID, risk score, and replay link.

For the demo, you can either:
- **Auto-approve** (`--auto-approve`): actions auto-approve after 3s, Discord still gets notified
- **Manual approve**: leave off the flag, get pinged on Discord, approve via `dashclaw approve <id>` from terminal or the dashboard

## Environment Variables

```bash
# DashClaw (existing)
DASHCLAW_BASE_URL=http://localhost:3000
DASHCLAW_API_KEY=oc_live_...

# Sepolia Testnet (new)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_free_key
SEPOLIA_PRIVATE_KEY=0x_your_sepolia_test_wallet_private_key

# Optional
DEMO_DELAY_MS=2500        # ms between cycles (default 2500)
DEMO_AUTO_APPROVE=false   # auto-approve actions in demo mode
```

## Setup Instructions (in README)

```markdown
## Live Demo Setup

### 1. Get free Sepolia ETH
- Go to https://cloud.google.com/application/web3/faucet/ethereum/sepolia
- Enter your wallet address, get 0.05 free test ETH
- Or use Alchemy faucet (https://sepoliafaucet.com) for 0.5 ETH/day

### 2. Get free test USDC
- Circle's Sepolia USDC faucet: https://faucet.circle.com
- Select "Ethereum Sepolia" and your wallet address
- Get 100 free test USDC

### 3. Get free Sepolia RPC
- Sign up at https://alchemy.com (free tier = 300M compute units/month)
- Create a Sepolia app, copy the RPC URL

### 4. Configure
cp .env.example .env
# Add: SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, DASHCLAW_BASE_URL, DASHCLAW_API_KEY

### 5. Run the demo
node src/demo.js --cycles 50

### 6. Watch it live
- Open your DashClaw dashboard — Mission Control shows real-time decisions
- Open the Learning page — watch the velocity curve build
- If Discord is configured, approval requests ping your channel
```

## What the DashClaw Dashboard Shows After 50 Cycles

- **Mission Control**: 50 real decisions with varying risk scores, some blocked, some approved
- **Fleet > treasury-claw-fleet**: Online with 3 connections, 50 decisions, learning curve
- **Security**: Risk signals from volatile market cycles
- **Drift**: Alerts if market conditions shifted mid-demo
- **Learning**: Velocity chart showing improvement from cycle 1-50
- **Feedback**: 50 auto-rated outcomes based on real slippage
- **Approvals**: History of approved/blocked/auto-approved actions
- **Context Threads**: 50 complete reasoning trails, each replayable

## Files

| File | Purpose |
|------|---------|
| `src/price-feed.js` | Create — round-robin multi-source price fetcher |
| `src/market-analyzer.js` | Create — portfolio analysis + proposal generation |
| `src/sepolia-swap.js` | Create — real Uniswap V3 swaps on Sepolia |
| `src/demo.js` | Create — demo runner orchestrating N live cycles |
| `src/treasury-agent.js` | Modify — import new modules, wire into existing loop |
| `.env.example` | Modify — add Sepolia vars |
| `README.md` | Modify — add demo setup instructions |

## Non-Goals

- No mainnet transactions (demo is Sepolia only)
- No custom token deployments (uses existing Sepolia WETH + USDC)
- No frontend/UI for the demo itself (DashClaw dashboard IS the UI)
- No Venice LLM integration yet (market analyzer replaces the stub with real math)
