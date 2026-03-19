import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildGovernedPaidSpendRequest } from '../src/governed-paid-spend.js';

describe('buildGovernedPaidSpendRequest', () => {
  it('builds a governed AgentCash paid-spend request shape for DashClaw', () => {
    const result = buildGovernedPaidSpendRequest({
      purpose: 'market research for hackathon submission',
      query: 'best treasury governance demos',
      maxUsd: 2,
    });

    assert.equal(result.actionType, 'api');
    assert.equal(result.operation, 'paid_api_spend');
    assert.equal(result.spendRail, 'agentcash_usdc');
    assert.equal(result.provider, 'stableenrich.dev');
    assert.match(result.declaredGoal, /governed spend controls/i);
    assert.match(result.approvalContext, /AgentCash rail/i);
  });

  it('rejects blank purpose or query', () => {
    assert.throws(() => buildGovernedPaidSpendRequest({ purpose: '', query: 'x' }), /purpose is required/);
    assert.throws(() => buildGovernedPaidSpendRequest({ purpose: 'x', query: ' ' }), /query is required/);
  });
});
