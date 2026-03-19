export function chooseHonestProductWedge(status) {
  const verifiedSpendRails = [];
  const blockedSpendRails = [];

  if (status.hasAgentCashUsdcWallet && status.hasAgentCashCreditHistory) {
    verifiedSpendRails.push('AgentCash USDC wallet with prior paid API credit purchases');
  }

  if (status.hasDashClawPolicyProof) {
    verifiedSpendRails.push('DashClaw-governed treasury decision path');
  }

  if (status.hasRewiredEthWalletPath) {
    verifiedSpendRails.push('Rewired ETH wallet execution path prepared for Base and Sepolia');
  }

  if (!status.hasBaseGas) {
    blockedSpendRails.push('Base write execution still needs gas verification');
  }

  if (!status.hasSepoliaGas) {
    blockedSpendRails.push('Sepolia receipt and swap execution still need testnet gas');
  }

  if (!status.hasSepoliaUsdc) {
    blockedSpendRails.push('Sepolia swap execution still needs testnet USDC');
  }

  const wedge =
    status.hasDashClawPolicyProof &&
    status.hasAgentCashUsdcWallet &&
    status.hasAgentCashCreditHistory &&
    status.hasRewiredEthWalletPath
      ? 'governed-agent-spend-first'
      : 'policy-first';

  const coreClaim =
    wedge === 'governed-agent-spend-first'
      ? 'TreasuryClaw is strongest as a governed spending demo: one spend rail is already funded for paid API actions, while the rewired ETH wallet path shows how the same guarded decision loop expands to onchain execution.'
      : 'TreasuryClaw is strongest as a policy-first demo until a spend rail is both funded and proven.';

  const cheapestNextRealMoneyPath =
    wedge === 'governed-agent-spend-first'
      ? 'Use the already-funded AgentCash wallet for a paid API-backed governed demo now, then bridge a small amount of ETH to Base for the first onchain proof.'
      : 'Get one low-cost funded spend rail and keep the submission focused on governed execution proof.';

  return {
    wedge,
    coreClaim,
    verifiedSpendRails,
    blockedSpendRails,
    cheapestNextRealMoneyPath,
  };
}
