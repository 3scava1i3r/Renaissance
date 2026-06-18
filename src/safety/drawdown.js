import { config, STATE } from '../config.js';
import * as pnl from '../monitoring/pnl.js';
import * as journal from '../monitoring/journal.js';
import * as telegram from '../monitoring/telegram.js';

let halted = false;
let tradesToday = 0;
let lastTradeDate = '';

export function check() {
  if (halted) return false;

  const summary = pnl.getSummary();
  if (summary.drawdownPct >= config.rules.maxDrawdownPct) {
    halted = true;
    console.error(`[Drawdown] HALTED at ${summary.drawdownPct.toFixed(1)}% (limit: ${config.rules.maxDrawdownPct}%)`);
    return false;
  }

  return true;
}

export function checkMinTrades() {
  const today = new Date().toISOString().split('T')[0];

  if (today !== lastTradeDate) {
    tradesToday = 0;
    lastTradeDate = today;
  }

  const count = journal.getTradeCountToday();
  tradesToday = count;

  if (count < config.rules.minTradesPerDay) {
    console.log(`[Trades] ${count} today (min: ${config.rules.minTradesPerDay})`);
  }

  return count >= config.rules.minTradesPerDay;
}

export function reset() {
  halted = false;
}

export function isHalted() {
  return halted;
}
