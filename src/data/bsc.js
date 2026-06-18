import { createPublicClient, http, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { config } from '../config.js';

const publicClient = createPublicClient({
  chain: bsc,
  transport: http(config.bsc.rpc),
});

let walletClient = null;
if (config.wallet.privateKey) {
  const account = privateKeyToAccount(config.wallet.privateKey);
  walletClient = createWalletClient({
    account,
    chain: bsc,
    transport: http(config.bsc.rpc),
  });
}

export async function getPortfolio() {
  try {
    const [bnbBalance, usdcBalance] = await Promise.all([
      getBalance(config.wallet.address),
      getTokenBalance(config.wallet.address, USDC_ADDRESS),
    ]);
    return {
      bnb: Number(bnbBalance),
      usdc: Number(usdcBalance),
      totalUsd: Number(bnbBalance) * 600 + Number(usdcBalance),
      address: config.wallet.address,
    };
  } catch (err) {
    console.warn('[BSC] Portfolio fetch failed:', err.message);
    return { bnb: 0, usdc: 0, totalUsd: 0, address: config.wallet.address };
  }
}

export async function getBalance(address) {
  try {
    const balance = await publicClient.getBalance({ address });
    return formatEther(balance);
  } catch {
    return '0';
  }
}

export async function getTokenBalance(address, tokenAddress) {
  try {
    const data = await publicClient.readContract({
      address: tokenAddress,
      abi: [ERC20_ABI],
      functionName: 'balanceOf',
      args: [address],
    });
    return formatUnits(data, 18);
  } catch {
    return '0';
  }
}

export async function getTransactionReceipt(txHash) {
  try {
    return await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return null;
  }
}

export function getPublicClient() {
  return publicClient;
}

export function getWalletClient() {
  return walletClient;
}

const USDC_ADDRESS = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
];

function formatEther(wei) {
  return (Number(wei) / 1e18).toFixed(6);
}

function formatUnits(value, decimals) {
  return (Number(value) / 10 ** decimals).toFixed(6);
}
