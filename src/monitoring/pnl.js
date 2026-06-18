import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const STATE_FILE = path.join(DATA_DIR, 'pnl_state.json');

let state = {
  peakValue: 0,
  currentValue: 0,
  startingValue: 10000,
  trades: [],
  totalPnl: 0,
  totalCosts: 0,
};

const TXN_COST_PER_TRADE = 0.50;
const GAS_COST_PER_TX = 0.01;

export function load() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      console.log(`[PnL] Loaded: peak=$${state.peakValue}, current=$${state.currentValue}`);
    } else {
      state.startingValue = state.currentValue;
      state.peakValue = state.currentValue;
      save();
    }
  } catch (err) {
    console.warn('[PnL] Could not load state:', err.message);
  }
}

export function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function recordTrade(trade) {
  if (!trade) return;

  const cost = TXN_COST_PER_TRADE + GAS_COST_PER_TX;
  state.totalCosts += cost;
  state.trades.push({
    ...trade,
    costs: cost,
    timestamp: new Date().toISOString(),
  });

  save();
}

export function updatePortfolio() {
  // In real mode, this reads actual portfolio from BSC
  // For now, tracks current value
  state.currentValue = calculateCurrentValue();
  if (state.currentValue > state.peakValue) {
    state.peakValue = state.currentValue;
  }
  save();
}

export function getSummary() {
  const drawdown = state.peakValue > 0
    ? ((state.peakValue - state.currentValue) / state.peakValue) * 100
    : 0;

  return {
    startingValue: state.startingValue,
    currentValue: state.currentValue,
    peakValue: state.peakValue,
    drawdownPct: Math.max(0, drawdown),
    totalPnl: state.currentValue - state.startingValue,
    totalCosts: state.totalCosts,
    tradeCount: state.trades.length,
    pnlAfterCosts: state.currentValue - state.startingValue - state.totalCosts,
  };
}

export function logPnl() {
  const s = getSummary();
  console.log(`[PnL] $${s.currentValue.toFixed(2)} | +$${s.totalPnl.toFixed(2)} | Drawdown: ${s.drawdownPct.toFixed(1)}% | Trades: ${s.tradeCount} | Costs: $${s.totalCosts.toFixed(2)}`);
  return s;
}

function calculateCurrentValue() {
  let value = state.startingValue;
  for (const trade of state.trades) {
    // Simplified PnL: each trade is a binary outcome
    // In real mode, actual position PnL is used
  }
  return value;
}

export function adjustValue(delta) {
  state.currentValue += delta;
  if (state.currentValue > state.peakValue) {
    state.peakValue = state.currentValue;
  }
  save();
}
