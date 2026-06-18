import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const POSITIONS_FILE = path.join(DATA_DIR, 'positions.json');
const JOURNAL_FILE = path.join(DATA_DIR, 'trade_journal.jsonl');
const SUMMARY_FILE = path.join(DATA_DIR, 'cycle_summary.md');

let positions = [];
let cycles = [];

export function recordEntry(trade) {
  if (!trade || !trade.symbol) return;

  const entry = {
    ...trade,
    id: `trade_${Date.now().toString(36)}`,
    recordedAt: new Date().toISOString(),
    status: 'open',
  };

  positions.push(entry);
  fs.appendFileSync(JOURNAL_FILE, JSON.stringify(entry) + '\n');
  savePositions();
  console.log(`[Journal] Trade recorded: ${trade.direction} ${trade.symbol} $${trade.size}`);
}

export function getTradeCountToday() {
  const today = new Date().toISOString().split('T')[0];
  return positions.filter(p => p.timestamp && p.timestamp.startsWith(today)).length;
}

export function cycleSummary(data) {
  cycles.push(data);
  if (cycles.length > 20) cycles = cycles.slice(-20);

  const summary = [
    `## Cycle #${data.cycleCount} — ${new Date().toISOString()}`,
    `State: ${data.state}`,
    `Action: ${data.result?.action || 'N/A'}`,
    data.result?.reason ? `Reason: ${data.result.reason}` : '',
    data.result?.asset ? `Asset: ${data.result.asset}` : '',
    data.result?.sizePct ? `Size: ${data.result.sizePct}%` : '',
    '---',
  ].filter(Boolean).join('\n') + '\n';

  fs.appendFileSync(SUMMARY_FILE, summary);
}

function savePositions() {
  fs.writeFileSync(POSITIONS_FILE, JSON.stringify(positions, null, 2));
}
