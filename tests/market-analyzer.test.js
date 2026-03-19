import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { analyzePortfolio } from '../src/market-analyzer.js';

describe('market analyzer', () => {
  it('returns no rebalance when the treasury is empty', () => {
    const result = analyzePortfolio({ positions: [] }, 3500);

    assert.equal(result.rebalanceNeeded, false);
    assert.equal(result.direction, 'hold');
    assert.equal(result.amountUSD, 0);
    assert.equal(result.totalUSD, 0);
  });

  it('proposes buying ETH when USDC is overweight', () => {
    const result = analyzePortfolio(
      {
        positions: [
          { token: 'USDC', amount: '900' },
          { token: 'WETH', amount: '0.05' },
        ],
      },
      3000,
    );

    assert.equal(result.rebalanceNeeded, true);
    assert.equal(result.direction, 'buy_eth');
    assert.equal(result.amountUSD, 105);
    assert.equal(result.riskScore, 55);
    assert.equal(result.currentEthAllocation, 14);
  });

  it('caps sell recommendations at ten percent of treasury value', () => {
    const result = analyzePortfolio(
      {
        positions: [
          { token: 'USDC', amount: '500' },
          { token: 'WETH', amount: '2' },
        ],
      },
      3000,
    );

    assert.equal(result.rebalanceNeeded, true);
    assert.equal(result.direction, 'sell_eth');
    assert.equal(result.amountUSD, 650);
    assert.equal(result.totalUSD, 6500);
    assert.equal(result.riskScore, 55);
  });
});
