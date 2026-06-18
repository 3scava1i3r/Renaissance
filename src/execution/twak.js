import { execSync } from 'child_process';
import { config } from '../config.js';

export function isInstalled() {
  try {
    execSync('twak --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function swap(fromToken, toToken, amount, chain = 'bsc') {
  try {
    const cmd = `twak swap ${amount} ${fromToken} ${toToken} --chain ${chain} --json`;
    console.log(`[TWAK] ${cmd}`);
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
    return JSON.parse(output);
  } catch (err) {
    console.error('[TWAK] Swap failed:', err.message);
    // Fallback: simulate for testnet
    return simulateSwap(fromToken, toToken, amount);
  }
}

export async function getPortfolio() {
  try {
    const output = execSync('twak wallet portfolio --json', { encoding: 'utf-8', timeout: 10000 });
    return JSON.parse(output);
  } catch {
    return { totalUsd: 0, chains: {} };
  }
}

export async function getPrice(token) {
  try {
    const output = execSync(`twak price ${token} --json`, { encoding: 'utf-8', timeout: 10000 });
    return JSON.parse(output);
  } catch {
    return { price: 0, symbol: token };
  }
}

export async function signTransaction(tx) {
  try {
    const output = execSync(`twak sign --tx '${JSON.stringify(tx)}' --json`, { encoding: 'utf-8', timeout: 15000 });
    return JSON.parse(output);
  } catch (err) {
    console.error('[TWAK] Sign failed:', err.message);
    return { signed: false, error: err.message };
  }
}

function simulateSwap(fromToken, toToken, amount) {
  console.log(`[TWAK] Simulated: swap ${amount} ${fromToken} → ${toToken}`);
  return {
    success: true,
    simulated: true,
    from: { token: fromToken, amount },
    to: { token: toToken, amount: (parseFloat(amount) * 0.997).toFixed(2) },
    txHash: `0x${Date.now().toString(16)}`,
  };
}

export async function createAlert(token, condition, value) {
  try {
    const cond = condition === 'above' ? '--above' : '--below';
    const output = execSync(`twak alert create --token ${token} ${cond} ${value} --json`, { encoding: 'utf-8', timeout: 10000 });
    return JSON.parse(output);
  } catch {
    return { id: `alt_${Date.now().toString(36)}`, simulated: true };
  }
}
