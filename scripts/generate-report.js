import { runBacktest } from './backtest.js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportDir = resolve(__dirname, '../report');

mkdirSync(reportDir, { recursive: true });

const result = runBacktest({
  periods: parseInt(process.argv[2]) || 540,
  initialCapital: parseFloat(process.argv[3]) || 1000,
  seed: parseInt(process.argv[4]) || 42,
  dataSource: process.argv[5] || 'auto',
});

const { config, results, equity, trades } = result;
const safe = JSON.stringify;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Renaissance — Backtest Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js" integrity="sha384-Z6Zas/TnGUGTilGQNU/X6KPZ0MxFgDCUPw5N7MUTlNH5d1JF0I1Q8p3Z2LyWq8S" crossorigin="anonymous"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#e6edf3;padding:24px;max-width:1400px;margin:0 auto}
h1{font-size:24px;font-weight:600;margin-bottom:4px}
.subtitle{color:#8b949e;font-size:14px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
.card{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:20px}
.card .label{font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.card .value{font-size:32px;font-weight:600}
.card .value.positive{color:#3fb950}
.card .value.negative{color:#f85149}
.card .value.neutral{color:#e6edf3}
.chart-wrap{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:20px;margin-bottom:24px}
.chart-wrap h2{font-size:16px;font-weight:500;margin-bottom:12px;color:#8b949e}
canvas{width:100%!important}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:8px 12px;color:#8b949e;font-weight:500;border-bottom:2px solid #30363d;cursor:pointer;user-select:none}
th:hover{color:#e6edf3}
td{padding:6px 12px;border-bottom:1px solid #21262d}
tr:hover td{background:#1c2128}
.num{text-align:right;font-variant-numeric:tabular-nums}
.green{color:#3fb950}
.red{color:#f85149}
.legend{margin-bottom:16px;display:flex;gap:16px;font-size:13px;color:#8b949e}
.legend span{display:flex;align-items:center;gap:6px}
.legend .dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.summary{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:16px;margin-bottom:24px;font-size:13px;color:#8b949e;line-height:1.8}
.summary strong{color:#e6edf3}
@media(max-width:600px){.grid{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
<h1>Renaissance — Backtest Report</h1>
<p class="subtitle">BNB Hack 2026 · Track 2: Strategy Skills &middot; Generated ${new Date().toISOString().slice(0,10)}</p>

<div class="grid">
  <div class="card"><div class="label">Total Return</div><div class="value ${results.totalReturn >= 0 ? 'positive' : 'negative'}">${results.totalReturn >= 0 ? '+' : ''}${results.totalReturn.toFixed(2)}%</div></div>
  <div class="card"><div class="label">Sharpe Ratio</div><div class="value neutral">${results.sharpeRatio.toFixed(2)}</div></div>
  <div class="card"><div class="label">Max Drawdown</div><div class="value negative">${results.maxDrawdown.toFixed(2)}%</div></div>
  <div class="card"><div class="label">Win Rate</div><div class="value neutral">${results.winRate.toFixed(1)}%</div></div>
  <div class="card"><div class="label">Total Trades</div><div class="value neutral">${results.totalTrades}</div></div>
  <div class="card"><div class="label">Final Equity</div><div class="value positive">$${results.finalEquity.toLocaleString(undefined,{maximumFractionDigits:2})}</div></div>
</div>

<div class="chart-wrap"><h2>Equity Curve</h2><canvas id="equityChart" height="320"></canvas></div>

<div class="chart-wrap"><h2>Trade PnL</h2><div class="legend"><span><span class="dot" style="background:#3fb950"></span>Wins (${results.winningTrades})</span><span><span class="dot" style="background:#f85149"></span>Losses (${results.losingTrades})</span></div><canvas id="pnlChart" height="240"></canvas></div>

<div class="chart-wrap"><h2>Trade Journal (${trades.length} trades)</h2>
<table id="journal"><thead><tr>
  <th data-col="trade">#</th>
  <th data-col="symbol">Symbol</th>
  <th data-col="direction">Dir</th>
  <th data-col="entryPrice" class="num">Entry</th>
  <th data-col="exitPrice" class="num">Exit</th>
  <th data-col="pnl" class="num">PnL</th>
  <th data-col="sizeUsd" class="num">Size</th>
  <th data-col="leverage" class="num">Lev</th>
  <th data-col="exitReason">Reason</th>
</tr></thead><tbody></tbody></table></div>

<div class="summary">
  <strong>Config:</strong> Initial Capital: $${config.initialCapital} &middot; Periods: ${config.periods} &middot; Interval: ${config.intervalHours}h &middot; Data: ${config.dataSource} &middot; Txn Cost: $${config.txnCost} &middot; Max DD Halt: 30%
</div>

<script>
const DATA = ${safe(result, null, 2)};
const { equity, trades, results: res, config: cfg } = DATA;
const green = '#3fb950', red = '#f85149', blue = '#58a6ff';

Chart.defaults.color = '#8b949e';
Chart.defaults.borderColor = '#30363d';

new Chart(document.getElementById('equityChart'), {
  type: 'line',
  data: {
    labels: equity.map((_,i) => i.toString()),
    datasets: [{
      label: 'Equity',
      data: equity.map((v,i) => ({x:i,y:v})),
      borderColor: blue,
      backgroundColor: (ctx) => {
        if (!ctx.chart.chartArea) return blue + '20';
        const g = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom);
        g.addColorStop(0, blue + '40');
        g.addColorStop(1, blue + '05');
        return g;
      },
      fill: true,
      tension: 0.1,
      pointRadius: 0,
      borderWidth: 2,
    }, {
      label: 'Initial Capital',
      data: [{x:0,y:cfg.initialCapital},{x:equity.length-1,y:cfg.initialCapital}],
      borderColor: '#8b949e',
      borderDash: [6,4],
      pointRadius: 0,
      borderWidth: 1,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'nearest' },
    plugins: { legend: { display: false } },
    scales: {
      x: { title: { display: true, text: 'Period' }, grid: { color: '#21262d' } },
      y: { title: { display: true, text: 'Equity ($)' }, grid: { color: '#21262d' } },
    },
  },
});

new Chart(document.getElementById('pnlChart'), {
  type: 'bar',
  data: {
    labels: trades.map(t => '#' + t.trade),
    datasets: [{
      label: 'PnL',
      data: trades.map(t => t.pnl),
      backgroundColor: trades.map(t => t.pnl > 0 ? green : red),
      borderRadius: 2,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { font: { size: 9 } }, grid: { color: '#21262d' } },
      y: { title: { display: true, text: 'PnL ($)' }, grid: { color: '#21262d' } },
    },
  },
});

const tbody = document.querySelector('#journal tbody');
trades.forEach(t => {
  const tr = document.createElement('tr');
  const cls = t.pnl > 0 ? 'green' : 'red';
  tr.innerHTML = [
    t.trade, t.symbol, t.direction,
    '$' + t.entryPrice.toFixed(2), '$' + t.exitPrice.toFixed(2),
    '<span class="' + cls + '">' + (t.pnl > 0 ? '+' : '') + t.pnl.toFixed(2) + '</span>',
    '$' + t.sizeUsd.toFixed(2), t.leverage, t.exitReason
  ].map((v, i) => {
    const isNum = [3,4,5,6,7].includes(i);
    return '<td' + (isNum ? ' class="num"' : '') + '>' + v + '</td>';
  }).join('');
  tbody.appendChild(tr);
});

document.querySelectorAll('#journal th').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    const tbody = th.closest('table').querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const idx = Array.from(th.parentNode.children).indexOf(th);
    const isNum = ['entryPrice','exitPrice','pnl','sizeUsd','leverage','trade'].includes(col);
    rows.sort((a, b) => {
      const av = a.children[idx].textContent.replace(/[$,]/g,'');
      const bv = b.children[idx].textContent.replace(/[$,]/g,'');
      return isNum ? parseFloat(av) - parseFloat(bv) : av.localeCompare(bv);
    });
    rows.forEach(r => tbody.appendChild(r));
  });
});
</script>
</body>
</html>`;

const outPath = resolve(reportDir, 'index.html');
writeFileSync(outPath, html, 'utf-8');
console.log('Report written to', outPath);
