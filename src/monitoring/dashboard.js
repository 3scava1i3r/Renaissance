import express from 'express';
import * as pnl from './pnl.js';
import * as journal from './journal.js';
import { getState } from '../loop.js';
import { config } from '../config.js';
import { isEligible } from '../data/tokens.js';

export function createDashboard() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.get('/', (req, res) => {
    const state = getState();
    const summary = pnl.getSummary();
    const recent = journal.getRecentEntries(10);

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Renaissance — Trading Agent</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace; background: #0a0a0f; color: #e0e0e0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.5rem; color: #00ff88; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 0.85rem; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .card { background: #12121a; border: 1px solid #1e1e2e; border-radius: 8px; padding: 16px; }
    .card .label { font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .card .value { font-size: 1.3rem; font-weight: 600; margin-top: 4px; }
    .card .value.green { color: #00ff88; }
    .card .value.red { color: #ff4444; }
    .card .value.yellow { color: #ffaa00; }
    .card .value.white { color: #e0e0e0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { text-align: left; color: #666; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.75rem; padding: 8px 4px; border-bottom: 1px solid #1e1e2e; }
    td { padding: 8px 4px; border-bottom: 1px solid #12121a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .badge.long { background: #003322; color: #00ff88; }
    .badge.short { background: #330011; color: #ff4444; }
    .badge.hold { background: #222; color: #888; }
    .badge.open { background: #002233; color: #00aaff; }
    .badge.closed { background: #222; color: #666; }
    .status-bar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .status-dot.running { background: #00ff88; box-shadow: 0 0 8px #00ff8844; }
    .status-dot.halted { background: #ff4444; box-shadow: 0 0 8px #ff444444; }
    .status-dot.idle { background: #ffaa00; }
    .section-title { font-size: 0.9rem; color: #888; margin: 20px 0 8px; }
    .config-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.8rem; }
    .config-row .key { color: #666; }
    .config-row .val { color: #aaa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Renaissance</h1>
    <div class="subtitle">Autonomous AI Trading Agent — BNB Hack Track 1</div>

    <div class="status-bar">
      <span class="status-dot ${state.state === 'HALTED' ? 'halted' : state.state === 'SCANNING' ? 'running' : 'idle'}"></span>
      <span>${state.state || 'IDLE'}</span>
      <span style="color:#666">|</span>
      <span>Cycle #${state.cycleCount}</span>
      <span style="color:#666">|</span>
      <span>${config.wallet.address ? config.wallet.address.slice(0, 10) + '...' : 'no wallet'}</span>
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">Portfolio Value</div>
        <div class="value ${summary.currentValue >= summary.startingValue ? 'green' : 'red'}">$${summary.currentValue.toFixed(2)}</div>
      </div>
      <div class="card">
        <div class="label">PnL</div>
        <div class="value ${summary.totalPnl >= 0 ? 'green' : 'red'}">${summary.totalPnl >= 0 ? '+' : ''}$${summary.totalPnl.toFixed(2)}</div>
      </div>
      <div class="card">
        <div class="label">Drawdown</div>
        <div class="value ${summary.drawdownPct > 20 ? 'red' : summary.drawdownPct > 10 ? 'yellow' : 'green'}">${summary.drawdownPct.toFixed(1)}%</div>
      </div>
      <div class="card">
        <div class="label">Trades</div>
        <div class="value white">${summary.tradeCount}</div>
      </div>
      <div class="card">
        <div class="label">Transaction Costs</div>
        <div class="value white">$${summary.totalCosts.toFixed(2)}</div>
      </div>
      <div class="card">
        <div class="label">Peak Value</div>
        <div class="value green">$${summary.peakValue.toFixed(2)}</div>
      </div>
    </div>

    <div class="section-title">Configuration</div>
    <div style="margin-bottom:16px">
      <div class="config-row"><span class="key">Strategy</span><span class="val">${process.env.STRATEGY_NL || 'default: long ETH perps'}</span></div>
      <div class="config-row"><span class="key">Max Drawdown</span><span class="val">${config.rules.maxDrawdownPct}%</span></div>
      <div class="config-row"><span class="key">Max Leverage</span><span class="val">${config.rules.maxLeverage}x</span></div>
      <div class="config-row"><span class="key">Min Trades/Day</span><span class="val">${config.rules.minTradesPerDay}</span></div>
      <div class="config-row"><span class="key">Cycle Interval</span><span class="val">${config.rules.cycleIntervalMs / 60000}min</span></div>
      <div class="config-row"><span class="key">Eligible Tokens</span><span class="val">149 BEP-20</span></div>
    </div>

    <div class="section-title">Recent Trades</div>
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Symbol</th>
          <th>Direction</th>
          <th>Size</th>
          <th>Leverage</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${recent.length === 0 ? '<tr><td colspan="6" style="color:#444;text-align:center;padding:20px">No trades yet</td></tr>' :
          recent.map(t => `
        <tr>
          <td style="color:#666">${new Date(t.timestamp).toLocaleTimeString()}</td>
          <td>${t.symbol || '—'}</td>
          <td><span class="badge ${(t.direction || 'HOLD').toLowerCase()}">${t.direction || 'HOLD'}</span></td>
          <td>$${t.size || 0}</td>
          <td>${t.leverage || '—'}x</td>
          <td><span class="badge ${t.status || 'open'}">${t.status || 'open'}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div class="section-title" style="margin-top:32px;color:#333;font-size:0.7rem">
      Renaissance — BNB Hack: AI Trading Agent Edition
    </div>
  </div>
</body>
</html>
    `);
  });

  app.listen(port, () => {
    console.log(`[Dashboard] http://localhost:${port}`);
  });

  return app;
}
