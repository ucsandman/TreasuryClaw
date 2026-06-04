// src/onchain-receipts.js
import { createPublicClient, createWalletClient, http, keccak256, toBytes } from 'viem';
import { mainnet as ethereumMainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Write a governance decision receipt hash to Ethereum Mainnet.
 * Uses a 0-value self-transaction with the receipt hash as calldata.
 * Costs only gas (~21,000 + calldata gas). Verifiable on Etherscan.
 */
export async function writeDecisionReceipt(decision) {
  const privateKey = process.env.PRIVATE_KEY || process.env.ETHEREUM_MAINNET_PRIVATE_KEY || process.env.SEPOLIA_PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY or ETHEREUM_MAINNET_PRIVATE_KEY is not set');

  const rpcUrl = process.env.ETHEREUM_MAINNET_RPC_URL || process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://eth.llamarpc.com';
  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: ethereumMainnet, transport });
  const walletClient = createWalletClient({ account, chain: ethereumMainnet, transport });

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
    explorerUrl: `https://etherscan.io/tx/${txHash}`,
    receipt,
  };
}
