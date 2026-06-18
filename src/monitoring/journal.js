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
    status: trade.status || 'open',
  };

  positions.push(entry);
  fs.appendFileSync(JOURNAL_FILE, JSON.stringify(entry) + '\n');
  savePositions();
  console.log(`[Journal] Trade recorded: ${trade.direction} ${trade.symbol} $${trade.size}`);
}

export function closeEntry(position, closeData) {
  const idx = positions.findIndex(p => p.id === position.id);
  if (idx !== -1) {
    positions[idx] = { ...positions[idx], ...closeData };
    savePositions();
  }
  fs.appendFileSync(JOURNAL_FILE, JSON.stringify({ type: 'close', ...closeData }) + '\n');
}

export function getTradeCountToday() {
  const today = new Date().toISOString().split('T')[0];
  return positions.filter(p =>
    p.timestamp && p.timestamp.startsWith(today) && p.status === 'open'
  ).length;
}

export function getOpenPositions() {
  return positions.filter(p => p.status === 'open');
}

export function getRecentEntries(count = 10) {
  return [...positions].reverse().slice(0, count);
}

export function cycleSummary(data) {
  cycles.push(data);
  if (cycles.length > 20) cycles = cycles.slice(-20);

  const summary = [
    `## Cycle #${data.cycleCount} — ${new Date().toISOString()}`,
    `State: ${data.state}`,
    `Action: ${data.result?.action || 'N/A'}`,
    data.result?.symbol ? `Symbol: ${data.result.symbol}` : '',
    data.result?.reason ? `Reason: ${data.result.reason}` : '',
    data.result?.sizePct ? `Size: ${data.result.sizePct}%` : '',
    '---',
  ].filter(Boolean).join('\n') + '\n';

  try {
    fs.appendFileSync(SUMMARY_FILE, summary);
  } catch {}
}

function savePositions() {
  try {
    fs.writeFileSync(POSITIONS_FILE, JSON.stringify(positions, null, 2));
  } catch {}
}
