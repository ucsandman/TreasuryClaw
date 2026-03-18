// src/market-analyzer.js

const TARGET_ETH_ALLOCATION = 0.50;
const REBALANCE_THRESHOLD = 0.05;

/**
 * Analyze portfolio and compute a rebalance proposal.
 * @param {Object} balance - { positions: [{ token, amount }] }
 * @param {number} ethPrice - Current ETH/USD price
 * @returns {Object} Rebalance proposal with risk scoring
 */
export function analyzePortfolio(balance, ethPrice) {
  const ethValue = parseFloat(balance.positions.find(p => p.token === 'WETH')?.amount || 0) * ethPrice;
  const usdcValue = parseFloat(balance.positions.find(p => p.token === 'USDC')?.amount || 0);
  const totalUSD = ethValue + usdcValue;

  if (totalUSD === 0) {
    return { rebalanceNeeded: false, direction: 'hold', amountUSD: 0, riskScore: 0, confidence: 0, totalUSD: 0 };
  }

  const currentEthAllocation = ethValue / totalUSD;
  const deviation = currentEthAllocation - TARGET_ETH_ALLOCATION;
  const rebalanceNeeded = Math.abs(deviation) > REBALANCE_THRESHOLD;

  let direction = 'hold';
  let amountUSD = 0;
  if (deviation < -REBALANCE_THRESHOLD) {
    direction = 'buy_eth';
    amountUSD = Math.abs(deviation) * totalUSD * 0.5;
  } else if (deviation > REBALANCE_THRESHOLD) {
    direction = 'sell_eth';
    amountUSD = Math.abs(deviation) * totalUSD * 0.5;
  }

  // Cap at 10% of TVL per swap
  const maxSwap = totalUSD * 0.10;
  amountUSD = Math.min(amountUSD, maxSwap);

  // Risk scoring
  let riskScore = 20;
  if (amountUSD > totalUSD * 0.05) riskScore += 10;
  if (amountUSD > totalUSD * 0.08) riskScore += 15;
  if (Math.abs(deviation) > 0.15) riskScore += 10;
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
