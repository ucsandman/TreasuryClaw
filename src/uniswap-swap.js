/**
 * Uniswap Trading API integration for TreasuryClaw.
 *
 * Uses the recommended Trading API (https://trade-api.gateway.uniswap.org/v1)
 * for routing optimization. Backend script — no CORS concerns.
 *
 * Flow: check_approval → quote → swap → broadcast
 */

import { createWalletClient, createPublicClient, http, isAddress, isHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const API_URL = 'https://trade-api.gateway.uniswap.org/v1';

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.UNISWAP_API_KEY,
    'x-universal-router-version': '2.0',
  };
}

function getClients() {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL) });
  return { account, publicClient, walletClient };
}

/**
 * Step 1: Check if token approval is needed for the swap.
 * Returns the approval transaction if needed, or null if already approved.
 */
export async function checkApproval(walletAddress, tokenAddress, amount, chainId) {
  const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
  if (tokenAddress === ETH_ADDRESS) return null;

  const res = await fetch(`${API_URL}/check_approval`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ walletAddress, token: tokenAddress, amount, chainId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Approval check failed');

  return data.approval || null;
}

/**
 * Step 2: Get an executable quote from the Trading API.
 * Returns the full quote response (needed for the swap step).
 */
export async function getQuote({ swapper, tokenIn, tokenOut, chainId, amount }) {
  const res = await fetch(`${API_URL}/quote`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      swapper,
      tokenIn,
      tokenOut,
      tokenInChainId: String(chainId),
      tokenOutChainId: String(chainId),
      amount,
      type: 'EXACT_INPUT',
      slippageTolerance: 0.5,
      routingPreference: 'BEST_PRICE',
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Quote failed');

  console.log(`[Uniswap] Quote routing: ${data.routing}`);

  // Log output amount based on routing type
  if (data.routing === 'CLASSIC') {
    console.log(`[Uniswap] Output: ${data.quote.output.amount}`);
    console.log(`[Uniswap] Gas (USD): $${data.quote.gasFeeUSD}`);
  } else if (['DUTCH_V2', 'DUTCH_V3', 'PRIORITY'].includes(data.routing)) {
    const firstOutput = data.quote.orderInfo.outputs[0];
    console.log(`[Uniswap] Output (best): ${firstOutput.startAmount}`);
    console.log(`[Uniswap] Output (floor): ${firstOutput.endAmount}`);
    console.log('[Uniswap] Gasless (UniswapX)');
  }

  return data;
}

/**
 * Prepare the /swap request body with routing-aware permitData handling.
 */
function prepareSwapRequest(quoteResponse, signature) {
  const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;
  const request = { ...cleanQuote };

  const isUniswapX =
    quoteResponse.routing === 'DUTCH_V2' ||
    quoteResponse.routing === 'DUTCH_V3' ||
    quoteResponse.routing === 'PRIORITY';

  if (isUniswapX) {
    // UniswapX: signature only — permitData must NOT go to /swap
    if (signature) request.signature = signature;
  } else {
    // CLASSIC: both signature and permitData required together, or both omitted
    if (signature && permitData && typeof permitData === 'object') {
      request.signature = signature;
      request.permitData = permitData;
    }
  }

  return request;
}

/**
 * Validate the swap response before broadcasting to prevent on-chain reverts.
 */
function validateSwap(swap) {
  if (!swap?.data || swap.data === '' || swap.data === '0x') {
    throw new Error('swap.data is empty — quote may have expired. Re-fetch.');
  }
  if (!isHex(swap.data)) {
    throw new Error('swap.data is not valid hex');
  }
  if (!isAddress(swap.to) || !isAddress(swap.from)) {
    throw new Error('Invalid address in swap response');
  }
}

/**
 * Step 3: Execute the swap — get transaction from API, validate, and broadcast.
 * Returns the transaction hash.
 */
export async function executeUniswapSwap(quoteResponse, permit2Signature) {
  const swapRequest = prepareSwapRequest(quoteResponse, permit2Signature);

  const res = await fetch(`${API_URL}/swap`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(swapRequest),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Swap request failed');

  // Validate before broadcasting
  validateSwap(data.swap);

  // Broadcast transaction
  const { publicClient, walletClient } = getClients();

  const hash = await walletClient.sendTransaction({
    to: data.swap.to,
    data: data.swap.data,
    value: BigInt(data.swap.value || '0'),
  });

  console.log(`[Uniswap] Tx broadcast: ${hash}`);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[Uniswap] Confirmed in block ${receipt.blockNumber}`);

  return hash;
}
