import { config } from '../config.js';

const ATR_MULT = 2.7;
const HARD_SL_ATR_MULT = 2.4;
const HARD_SL_MIN_PCT = 10;
const HARD_SL_MAX_PCT = 14.98;
const ACTIVATE_AT = 0.69;
const TIME_STOP_HOURS = 72;

export async function getOpenPositions() {
  return [];
}

export async function checkStops(positions) {
  if (!positions || positions.length === 0) return { triggered: false };

  for (const pos of positions) {
    const trail = calculateTrail(pos);
    if (trail.triggered) {
      console.log(`[Stop] ${pos.symbol} — trailing stop hit at ${trail.price}`);
      return trail;
    }

    const timeStop = checkTimeStop(pos);
    if (timeStop.triggered) {
      console.log(`[Stop] ${pos.symbol} — time stop (72h) expired`);
      return timeStop;
    }
  }

  return { triggered: false };
}

export function updateTrailingStops() {
  return { triggered: false };
}

function calculateTrail(position) {
  const atr = position.atr || position.entryPrice * 0.05;
  const hardSl = position.entryPrice * (1 - Math.max(HARD_SL_ATR_MULT * atr / position.entryPrice, HARD_SL_MIN_PCT / 100));

  const gainPct = ((position.currentPrice || position.entryPrice) / position.entryPrice - 1) * 100;

  if (gainPct >= ACTIVATE_AT) {
    const peak = position.peakPrice || position.currentPrice || position.entryPrice;
    const trailPrice = peak - ATR_MULT * atr;
    const finalSl = Math.max(trailPrice, hardSl);
    return {
      triggered: (position.currentPrice || 0) <= finalSl,
      price: finalSl,
      peak,
      gainPct,
    };
  }

  return {
    triggered: (position.currentPrice || 0) <= hardSl,
    price: hardSl,
  };
}

function checkTimeStop(position) {
  if (!position.openedAt) return { triggered: false };
  const elapsed = (Date.now() - new Date(position.openedAt).getTime()) / (1000 * 60 * 60);
  return {
    triggered: elapsed >= TIME_STOP_HOURS,
    elapsedHours: elapsed,
  };
}

export function createStop(position) {
  return {
    symbol: position.symbol,
    entryPrice: position.entryPrice,
    hardSl: position.entryPrice * (1 - HARD_SL_ATR_MULT * 0.05),
    trailActivated: false,
    peakPrice: position.entryPrice,
    openedAt: new Date().toISOString(),
  };
}
