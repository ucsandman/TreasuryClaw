import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { chooseHonestProductWedge } from '../src/honest-framing.js';

describe('chooseHonestProductWedge', () => {
  it('prefers governed-agent-spend-first when one spend rail is funded and the onchain rail is governed but partially unfunded', () => {
    const result = chooseHonestProductWedge({
      hasDashClawPolicyProof: true,
      hasAgentCashUsdcWallet: true,
      hasAgentCashCreditHistory: true,
      hasRewiredEthWalletPath: true,
      hasBaseGas: false,
      hasSepoliaGas: false,
      hasSepoliaUsdc: false,
    });

    assert.equal(result.wedge, 'governed-agent-spend-first');
    assert.match(result.coreClaim, /governed spending/i);
    assert.deepEqual(result.verifiedSpendRails, [
      'AgentCash USDC wallet with prior paid API credit purchases',
      'DashClaw-governed treasury decision path',
      'Rewired ETH wallet execution path prepared for Base and Sepolia',
    ]);
    assert.deepEqual(result.blockedSpendRails, [
      'Base write execution still needs gas verification',
      'Sepolia receipt and swap execution still need testnet gas',
      'Sepolia swap execution still needs testnet USDC',
    ]);
    assert.equal(result.cheapestNextRealMoneyPath, 'Use the already-funded AgentCash wallet for a paid API-backed governed demo now, then bridge a small amount of ETH to Base for the first onchain proof.');
  });
});
