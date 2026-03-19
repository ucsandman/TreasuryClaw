import { chooseHonestProductWedge } from '../src/honest-framing.js';

const summary = chooseHonestProductWedge({
  hasDashClawPolicyProof: true,
  hasAgentCashUsdcWallet: true,
  hasAgentCashCreditHistory: true,
  hasRewiredEthWalletPath: true,
  hasBaseGas: false,
  hasSepoliaGas: false,
  hasSepoliaUsdc: false,
});

console.log(JSON.stringify(summary, null, 2));
