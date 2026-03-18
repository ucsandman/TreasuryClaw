// src/onchain-receipts.js
import { createPublicClient, createWalletClient, http, keccak256, toBytes } from 'viem';
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
