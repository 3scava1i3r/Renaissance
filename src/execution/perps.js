import * as twak from './twak.js';
import * as journal from '../monitoring/journal.js';

const PANCAKESWAP_PERPS_MARKET = {
  ETH: '0x...', // PancakeSwap perps ETH market on BSC
  BTC: '0x...',
  BNB: '0x...',
};

export async function execute(decision, strategy) {
  if (!decision || !decision.sizeUsd || decision.sizeUsd <= 0) {
    return { success: false, reason: 'Invalid size' };
  }

  const asset = strategy?.asset || 'ETH';
  const direction = decision.direction || strategy?.direction || 'LONG';
  const leverage = decision.leverage || 5;
  const collateralToken = 'USDC';

  console.log(`[Perps] ${direction} ${asset} | $${decision.sizeUsd} | ${leverage}x`);

  // For perps on PancakeSwap via TWAK:
  // We deposit USDC as collateral, open a position
  // TWAK swap handles the perps order routing

  const result = await twak.swap(
    collateralToken,
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
    entryPrice: 0, // Will be filled from TWAK result
    timestamp: new Date().toISOString(),
    txHash: result.txHash || `sim_${Date.now().toString(36)}`,
    strategy: strategy?.direction || 'LONG',
    confidence: decision.confidence || 0.75,
  };

  journal.recordEntry(entry);
  return entry;
}

export async function closePosition(position) {
  console.log(`[Perps] Close ${position.symbol} ${position.direction}`);

  const result = await twak.swap(
    `${position.symbol}-PERP`,
    'USDC',
    position.size.toFixed(2),
    'bsc'
  );

  return {
    ...position,
    closedAt: new Date().toISOString(),
    closeTxHash: result.txHash,
    pnl: calculatePnl(position),
  };
}

function calculatePnl(position) {
  if (!position.exitPrice || !position.entryPrice) return 0;
  const diff = position.direction === 'LONG'
    ? (position.exitPrice - position.entryPrice) / position.entryPrice
    : (position.entryPrice - position.exitPrice) / position.entryPrice;
  return diff * position.size * position.leverage;
}
