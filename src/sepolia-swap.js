/**
 * Sepolia Testnet — Real Uniswap V3 swap executor for TreasuryClaw.
 *
 * Executes actual on-chain swaps on Sepolia via SwapRouter02.
 * Uses viem for all chain interaction — no ethers dependency needed.
 *
 * Addresses (Sepolia):
 *   SwapRouter02: 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
 *   WETH:         0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
 *   USDC:         0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  getAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// ---------------------------------------------------------------------------
// Contract addresses (Sepolia testnet)
// ---------------------------------------------------------------------------
const SWAP_ROUTER = getAddress('0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E');
const WETH = getAddress('0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14');
const USDC = getAddress('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238');
const POOL_FEE = 3000; // 0.3%

// ---------------------------------------------------------------------------
// Minimal ABIs — only the functions we actually call
// ---------------------------------------------------------------------------
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
];

const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
];

// ---------------------------------------------------------------------------
// 1. Create Sepolia clients
// ---------------------------------------------------------------------------

/**
 * Creates viem public + wallet clients for Sepolia using env vars.
 * Requires SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY.
 */
export function createSepoliaClients() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY;

  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not set');
  if (!privateKey) throw new Error('SEPOLIA_PRIVATE_KEY is not set');

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  return { account, publicClient, walletClient };
}

// ---------------------------------------------------------------------------
// 2. Get Sepolia balances
// ---------------------------------------------------------------------------

/**
 * Reads real on-chain balances for ETH, USDC, and WETH on Sepolia.
 *
 * @param {string} address - Wallet address to query. Defaults to the configured wallet.
 * @returns {{ wallet: string, ethBalance: string, positions: Array<{ token: string, amount: string, address: string }> }}
 */
export async function getSepoliaBalance(address) {
  const { publicClient, account } = createSepoliaClients();
  const wallet = address || account.address;

  const [ethRaw, usdcRaw, wethRaw] = await Promise.all([
    publicClient.getBalance({ address: wallet }),
    publicClient.readContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet],
    }),
    publicClient.readContract({
      address: WETH,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet],
    }),
  ]);

  return {
    wallet,
    ethBalance: formatUnits(ethRaw, 18),
    positions: [
      { token: 'USDC', amount: formatUnits(usdcRaw, 6), address: USDC },
      { token: 'WETH', amount: formatUnits(wethRaw, 18), address: WETH },
    ],
  };
}

// ---------------------------------------------------------------------------
// 3. Execute Sepolia swap
// ---------------------------------------------------------------------------

/**
 * Executes a real Uniswap V3 swap on Sepolia testnet.
 *
 * @param {{ direction: 'buy_eth' | 'sell_eth', amountUSD: number, ethPrice: number }} params
 * @returns {{ txHash: string, gasUsed: bigint, status: string, blockNumber: bigint, explorerUrl: string }}
 */
export async function executeSepoliaSwap({ direction, amountUSD, ethPrice }) {
  if (!['buy_eth', 'sell_eth'].includes(direction)) {
    throw new Error(`Invalid direction: ${direction}. Use 'buy_eth' or 'sell_eth'.`);
  }
  if (!amountUSD || amountUSD <= 0) throw new Error('amountUSD must be positive');
  if (!ethPrice || ethPrice <= 0) throw new Error('ethPrice must be positive');

  const { account, publicClient, walletClient } = createSepoliaClients();
  const wallet = account.address;

  // Determine swap parameters based on direction
  let tokenIn, tokenOut, amountIn, decimalsIn;

  if (direction === 'buy_eth') {
    // USDC -> WETH
    tokenIn = USDC;
    tokenOut = WETH;
    decimalsIn = 6;
    amountIn = parseUnits(amountUSD.toString(), decimalsIn);
  } else {
    // WETH -> USDC (sell_eth)
    tokenIn = WETH;
    tokenOut = USDC;
    decimalsIn = 18;
    const ethAmount = amountUSD / ethPrice;
    amountIn = parseUnits(ethAmount.toFixed(18), decimalsIn);
  }

  console.log(`[Sepolia] ${direction}: ${formatUnits(amountIn, decimalsIn)} ${direction === 'buy_eth' ? 'USDC' : 'WETH'} -> ${direction === 'buy_eth' ? 'WETH' : 'USDC'}`);

  // Check allowance and approve if needed
  const currentAllowance = await publicClient.readContract({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [wallet, SWAP_ROUTER],
  });

  if (currentAllowance < amountIn) {
    const approveAmount = amountIn * 2n; // 2x headroom
    console.log(`[Sepolia] Approving ${formatUnits(approveAmount, decimalsIn)} for SwapRouter...`);

    const approveHash = await walletClient.writeContract({
      address: tokenIn,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [SWAP_ROUTER, approveAmount],
    });

    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    if (approveReceipt.status !== 'success') {
      throw new Error(`Approval tx failed: ${approveHash}`);
    }
    console.log(`[Sepolia] Approved: ${approveHash}`);
  }

  // Execute exactInputSingle
  console.log('[Sepolia] Submitting swap...');

  const swapHash = await walletClient.writeContract({
    address: SWAP_ROUTER,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn,
        tokenOut,
        fee: POOL_FEE,
        recipient: wallet,
        amountIn,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  console.log(`[Sepolia] Swap tx: ${swapHash}`);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });

  const result = {
    txHash: swapHash,
    gasUsed: receipt.gasUsed,
    status: receipt.status,
    blockNumber: receipt.blockNumber,
    explorerUrl: `https://sepolia.etherscan.io/tx/${swapHash}`,
  };

  console.log(`[Sepolia] Confirmed in block ${receipt.blockNumber} — ${result.explorerUrl}`);

  return result;
}
