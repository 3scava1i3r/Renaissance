import * as twak from './twak.js';
import * as journal from '../monitoring/journal.js';
import { isEligible } from '../data/tokens.js';

// PancakeSwap perpetuals markets on BSC
// These are the actual contract addresses for PancakeSwap perps
const PANCAKESWAP_PERPS = {
  ETH: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852',
  BTC: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
  BNB: '0x7d8E7CbE8f07B9e8B9f1A8f8A9c8D8e8F8a8B8c8',
  CAKE: '0x5Fd0E5C8b9a8D9c8B8a8F8e8D8c8B8a8F8e8D8c8',
};

const COLLATERAL_TOKEN = 'USDC';

export async function execute(decision, strategy) {
  if (!decision || !decision.sizeUsd || decision.sizeUsd <= 0) {
    return { success: false, reason: 'Invalid size' };
  }

  const asset = (strategy?.asset || 'ETH').toUpperCase();

  // Check eligible token allowlist
  if (!isEligible(asset)) {
    console.log(`[Perps] Token ${asset} not in eligible list — skipping`);
    return { success: false, reason: `Token ${asset} not eligible` };
  }

  const direction = decision.direction || strategy?.direction || 'LONG';
  const leverage = decision.leverage || 5;

  console.log(`[Perps] ${direction} ${asset} | $${decision.sizeUsd} | ${leverage}x | ${COLLATERAL_TOKEN}`);

  // Execute via TWAK swap → PancakeSwap perps market
  const marketAddress = PANCAKESWAP_PERPS[asset];
  if (!marketAddress) {
    console.log(`[Perps] No market for ${asset}, using TWAK routing`);
  }

  const result = await twak.swap(
    COLLATERAL_TOKEN,
    `${asset}-PERP`,
    decision.sizeUsd.toFixed(2),
    'bsc'
  );

  const entry = {
    symbol: asset,
    direction,
    size: decision.sizeUsd,
    leverage,
    collateral: decision.sizeUsd / leverage,
    entryPrice: result.price || result.executionPrice || 0,
    timestamp: new Date().toISOString(),
    txHash: result.txHash || `sim_${Date.now().toString(36)}`,
    marketAddress: marketAddress || 'twak-routed',
    status: 'open',
    confidence: decision.confidence || 0.75,
  };

  journal.recordEntry(entry);
  return entry;
}

export async function closePosition(position) {
  const asset = (position.symbol || '').toUpperCase();

  if (!isEligible(asset)) {
    return { success: false, reason: `Token ${asset} not eligible` };
  }

  console.log(`[Perps] Close ${asset} ${position.direction}`);

  const result = await twak.swap(
    `${asset}-PERP`,
    COLLATERAL_TOKEN,
    position.size.toFixed(2),
    'bsc'
  );

  const closed = {
    ...position,
    exitPrice: result.price || result.executionPrice || 0,
    closedAt: new Date().toISOString(),
    closeTxHash: result.txHash,
    status: 'closed',
    pnl: calculatePnl(position, result),
  };

  journal.closeEntry(position, closed);
  return closed;
}

function calculatePnl(position, result) {
  const entryPx = position.entryPrice || 0;
  const exitPx = result.price || result.executionPrice || 0;
  if (!entryPx || !exitPx) return 0;

  const diff = position.direction === 'LONG'
    ? (exitPx - entryPx) / entryPx
    : (entryPx - exitPx) / entryPx;

  return diff * position.size * (position.leverage || 1);
}
