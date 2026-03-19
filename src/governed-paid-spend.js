export function buildGovernedPaidSpendRequest({
  service = 'AgentCash',
  provider = 'stableenrich.dev',
  endpoint = '/api/exa/search',
  purpose,
  query,
  maxUsd = 1,
}) {
  if (!purpose || !purpose.trim()) {
    throw new Error('purpose is required');
  }

  if (!query || !query.trim()) {
    throw new Error('query is required');
  }

  return {
    actionType: 'api',
    operation: 'paid_api_spend',
    spendRail: 'agentcash_usdc',
    service,
    provider,
    endpoint,
    purpose: purpose.trim(),
    query: query.trim(),
    maxUsd,
    declaredGoal: `Use ${service} via ${provider}${endpoint} for ${purpose.trim()} under governed spend controls.`,
    approvalContext: 'TreasuryClaw governed paid API spend via funded AgentCash rail',
  };
}
