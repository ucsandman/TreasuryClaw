/**
 * ERC-8004 Agent Identity Registration on Base Mainnet.
 *
 * Registers TreasuryClaw as a Trustless Agent on the ERC-8004 Identity Registry,
 * checks registration status, and submits on-chain reputation feedback.
 *
 * Contracts (Base Mainnet, chain ID 8453):
 *   Identity Registry:   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 *   Reputation Registry:  0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// ---------------------------------------------------------------------------
// Contract addresses (Base Mainnet)
// ---------------------------------------------------------------------------
const IDENTITY_REGISTRY = getAddress('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
const REPUTATION_REGISTRY = getAddress('0x8004BAa17C55a88189AE136b182e5fdA19dE9b63');

// ---------------------------------------------------------------------------
// Minimal ABIs — only the functions we actually call
// ---------------------------------------------------------------------------
const IDENTITY_ABI = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
];

const REPUTATION_ABI = [
  {
    name: 'giveFeedback',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
  },
];

// ---------------------------------------------------------------------------
// Helper — create Base Mainnet clients
// ---------------------------------------------------------------------------

/**
 * Creates viem public + wallet clients for Base Mainnet using env vars.
 * Requires BASE_PRIVATE_KEY. BASE_RPC_URL defaults to https://mainnet.base.org.
 */
function createBaseClients() {
  const privateKey = process.env.BASE_PRIVATE_KEY;
  if (!privateKey) throw new Error('BASE_PRIVATE_KEY is not set');

  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });

  return { account, publicClient, walletClient };
}

// ---------------------------------------------------------------------------
// 1. Register agent on ERC-8004 Identity Registry
// ---------------------------------------------------------------------------

/**
 * Registers the agent on the ERC-8004 Identity Registry on Base Mainnet.
 *
 * @param {string} agentURI - URL pointing to agent metadata (e.g. GitHub repo URL)
 * @returns {{ txHash: string, agentId: string, explorerUrl: string }}
 */
export async function registerAgent(agentURI) {
  if (!agentURI || typeof agentURI !== 'string') {
    throw new Error('agentURI must be a non-empty string');
  }

  const { account, publicClient, walletClient } = createBaseClients();

  console.log(`[ERC-8004] Registering agent with URI: ${agentURI}`);
  console.log(`[ERC-8004] Wallet: ${account.address}`);

  const txHash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  console.log(`[ERC-8004] Tx submitted: ${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== 'success') {
    throw new Error(`Registration tx failed: ${txHash}`);
  }

  // Extract agentId from the Transfer event log (ERC-721 Transfer: topic[3] = tokenId)
  // Transfer(address from, address to, uint256 tokenId)
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const transferLog = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() &&
      log.topics[0] === TRANSFER_TOPIC
  );

  let agentId;
  if (transferLog && transferLog.topics[3]) {
    agentId = BigInt(transferLog.topics[3]).toString();
  } else {
    // Fallback: use balanceOf to infer (less precise but functional)
    console.warn('[ERC-8004] Could not extract agentId from Transfer event, using balanceOf fallback');
    const balance = await publicClient.readContract({
      address: IDENTITY_REGISTRY,
      abi: IDENTITY_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    agentId = balance.toString();
  }

  const explorerUrl = `https://basescan.org/tx/${txHash}`;

  console.log(`[ERC-8004] Registered! agentId=${agentId} — ${explorerUrl}`);

  return { txHash, agentId, explorerUrl };
}

// ---------------------------------------------------------------------------
// 2. Check how many agents the wallet has registered
// ---------------------------------------------------------------------------

/**
 * Returns how many agents the configured wallet has registered.
 * Useful to check before calling registerAgent() to avoid double-registration.
 *
 * @returns {number}
 */
export async function getAgentCount() {
  const { account, publicClient } = createBaseClients();

  const balance = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  return Number(balance);
}

// ---------------------------------------------------------------------------
// 3. Submit on-chain reputation feedback
// ---------------------------------------------------------------------------

/**
 * Submits reputation feedback on-chain for an agent via the Reputation Registry.
 *
 * @param {string|number|bigint} agentId - The target agent's token ID
 * @param {number} score - Score from 0-100
 * @param {string} tag - Feedback category tag (e.g. "treasury-management")
 * @param {string} feedbackURI - URI pointing to detailed feedback data
 * @returns {{ txHash: string, explorerUrl: string }}
 */
export async function submitOnChainFeedback(agentId, score, tag, feedbackURI) {
  if (agentId == null) throw new Error('agentId is required');
  if (typeof score !== 'number' || score < 0 || score > 100) {
    throw new Error('score must be a number between 0 and 100');
  }
  if (!tag || typeof tag !== 'string') throw new Error('tag must be a non-empty string');
  if (!feedbackURI || typeof feedbackURI !== 'string') throw new Error('feedbackURI must be a non-empty string');

  const { publicClient, walletClient } = createBaseClients();

  // Convert score (0-100) to int128 with 2 decimal places
  const value = BigInt(score) * 100n;

  console.log(`[ERC-8004] Submitting feedback for agent #${agentId}: score=${score}, tag=${tag}`);

  const txHash = await walletClient.writeContract({
    address: REPUTATION_REGISTRY,
    abi: REPUTATION_ABI,
    functionName: 'giveFeedback',
    args: [
      BigInt(agentId),          // agentId
      value,                     // value (int128, score * 100 for 2 decimals)
      2,                         // valueDecimals
      tag,                       // tag1
      '',                        // tag2 (unused)
      '',                        // endpoint (unused)
      feedbackURI,               // feedbackURI
      '0x0000000000000000000000000000000000000000000000000000000000000000', // feedbackHash (no hash)
    ],
  });

  console.log(`[ERC-8004] Feedback tx submitted: ${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== 'success') {
    throw new Error(`Feedback tx failed: ${txHash}`);
  }

  const explorerUrl = `https://basescan.org/tx/${txHash}`;

  console.log(`[ERC-8004] Feedback confirmed — ${explorerUrl}`);

  return { txHash, explorerUrl };
}
