import { runBacktest } from './backtest.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVOLUTION_LOG = resolve(__dirname, '../data/evolution_log.json');
const FIXED_SEED = 42;

const BASE_PARAMS = {
  rsiOversoldThreshold: 30,
  rsiOverboughtThreshold: 70,
  confidenceThreshold: 0.6,
  kellyFraction: 0.25,
  volDampeningFloor: 0.2,
  maxLeverage: 5,
  stopLossPct: 5,
  takeProfitPct: 5,
};

function loadBaseline() {
  if (existsSync(EVOLUTION_LOG)) {
    try {
      const log = JSON.parse(readFileSync(EVOLUTION_LOG, 'utf-8'));
      const entries = log.entries || [];
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].promotedParams) return entries[i].promotedParams;
      }
    } catch {}
  }
  return BASE_PARAMS;
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function runBacktestWithParams(params) {
  return runBacktest({
    periods: 360,
    initialCapital: 1000,
    seed: FIXED_SEED,
    evoParams: params,
  });
}

function scoreMutation(result) {
  const r = result.results;
  const s = r.sharpeRatio || 0;
  const ret = Math.max(0, r.totalReturn || 0);
  const dd = r.maxDrawdown || 0;
  const wr = r.winRate || 0;
  const tt = r.totalTrades || 0;

  const sharpeScore = Math.min(50, Math.max(0, s) * 2.5);
  const returnScore = Math.min(40, ret * 0.2);
  const ddPenalty = dd > 10 ? Math.min(40, (dd - 10) * 2) : 0;
  const winRateScore = wr * 0.2;
  const tradeScore = Math.min(15, tt * 0.2);

  return Math.max(0, sharpeScore + returnScore + winRateScore + tradeScore - ddPenalty);
}

function generateRandomMutations(params) {
  const mutations = [];
  const baseTs = Date.now() % 100000;
  const strategies = [
    { label: 'conservative', dir: -1, amp: 0.8 },
    { label: 'aggressive', dir: 1, amp: 0.9 },
    { label: 'balanced', dir: 1, amp: 0.4 },
  ];

  for (let i = 0; i < 3; i++) {
    const rd = mulberry32(baseTs + i * 31337 + (params.rsiOversoldThreshold || 30) * 7);
    rd(); rd(); rd();
    const d = strategies[i];
    const amp = d.amp * (0.7 + rd() * 0.3);
    const mutated = {
      rsiOversoldThreshold: Math.max(15, Math.min(45, params.rsiOversoldThreshold + Math.round(d.dir * amp * 6))),
      rsiOverboughtThreshold: Math.max(55, Math.min(85, params.rsiOverboughtThreshold + Math.round(d.dir * amp * 6))),
      confidenceThreshold: Math.max(0.4, Math.min(0.8, Math.round((params.confidenceThreshold + d.dir * amp * 0.06) * 100) / 100)),
      kellyFraction: Math.max(0.1, Math.min(0.5, Math.round((params.kellyFraction + d.dir * amp * 0.06) * 100) / 100)),
      volDampeningFloor: Math.max(0.1, Math.min(0.5, Math.round((params.volDampeningFloor - d.dir * amp * 0.04) * 100) / 100)),
      maxLeverage: Math.max(1, Math.min(5, params.maxLeverage)),
      stopLossPct: Math.max(2, Math.min(15, params.stopLossPct + Math.round(d.dir * amp * 2.5))),
      takeProfitPct: Math.max(2, Math.min(15, params.takeProfitPct + Math.round(d.dir * amp * 2.5))),
    };
    mutations.push({ params: mutated, label: `mutation_${d.label}` });
  }
  return mutations;
}

async function generateLLMMutations(params) {
  const veniceKey = process.env.VENICE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const mutations = [];

  const prompts = [
    { label: 'llm_conservative', goal: 'reduce max drawdown while keeping Sharpe > 1.0' },
    { label: 'llm_aggressive', goal: 'increase win rate and total return' },
    { label: 'llm_balanced', goal: 'improve risk-adjusted returns (lower drawdown, higher Sharpe)' },
  ];

  for (const p of prompts) {
    const prompt = `You are a strategy optimizer. Given these current parameters, suggest a mutation to ${p.goal}.
Current: RSI oversold=${params.rsiOversoldThreshold}, overbought=${params.rsiOverboughtThreshold}, conf threshold=${params.confidenceThreshold}, kelly fraction=${params.kellyFraction}, vol floor=${params.volDampeningFloor}, max lev=${params.maxLeverage}, stop=${params.stopLossPct}%, take=${params.takeProfitPct}%

Return ONLY a JSON object with these exact keys (numeric values only):
{
  "rsiOversoldThreshold": 15-45,
  "rsiOverboughtThreshold": 55-85,
  "confidenceThreshold": 0.4-0.8,
  "kellyFraction": 0.1-0.5,
  "volDampeningFloor": 0.1-0.5,
  "maxLeverage": 1-5,
  "stopLossPct": 2-15,
  "takeProfitPct": 2-15
}`;

    let result = null;
    try {
      if (veniceKey) {
        const { default: axios } = await import('axios');
        const { data } = await axios.post(
          'https://api.venice.ai/api/v1/chat/completions',
          { model: 'llama-3.3-70b', messages: [{ role: 'user', content: prompt }], temperature: 0.8 },
          { headers: { 'Authorization': `Bearer ${veniceKey}`, 'Content-Type': 'application/json' }, timeout: 15000 }
        );
        const text = data.choices[0].message.content;
        const jm = text.match(/\{[\s\S]*\}/);
        if (jm) result = JSON.parse(jm[0]);
      }
      if (!result && anthropicKey) {
        const { default: axios } = await import('axios');
        const { data } = await axios.post(
          'https://api.anthropic.com/v1/messages',
          { model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [{ role: 'user', content: prompt }] },
          { headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, timeout: 15000 }
        );
        const text = data.content[0].text;
        const jm = text.match(/\{[\s\S]*\}/);
        if (jm) result = JSON.parse(jm[0]);
      }
    } catch {}

    if (result) {
      const cleaned = {};
      for (const key of Object.keys(params)) {
        cleaned[key] = result[key] !== undefined ? result[key] : params[key];
      }
      mutations.push({ params: cleaned, label: p.label });
    }
  }
  return mutations;
}

export async function evolve() {
  console.log('═══════════════════════════════════════════');
  console.log('  Renaissance — Strategy Evolution Engine');
  console.log('═══════════════════════════════════════════\n');

  const baseline = loadBaseline();
  console.log('Current params:', JSON.stringify(baseline, null, 2), '\n');

  console.log('Running baseline backtest...');
  const baselineResult = runBacktestWithParams(baseline);
  const baselineScore = scoreMutation(baselineResult);
  console.log(`Baseline: Sharpe=${baselineResult.results.sharpeRatio}, Return=${baselineResult.results.totalReturn}%, DD=${baselineResult.results.maxDrawdown}%, WR=${baselineResult.results.winRate}%, Trades=${baselineResult.results.totalTrades}, Score=${baselineScore.toFixed(1)}\n`);

  const hasLLM = !!(process.env.VENICE_API_KEY || process.env.ANTHROPIC_API_KEY);
  const mutations = hasLLM ? await generateLLMMutations(baseline) : generateRandomMutations(baseline);

  if (hasLLM) {
    console.log(`Using LLM (${
      process.env.VENICE_API_KEY ? 'Venice AI' : 'Anthropic'
    }) for mutation generation...\n`);
  } else {
    console.log('No LLM API key set — using random mutations.\n');
  }

  console.log(`Testing ${mutations.length} mutations...\n`);

  let bestResult = { result: baselineResult, score: baselineScore, label: 'baseline', params: baseline };
  const results = [{ label: 'baseline', result: baselineResult, score: baselineScore, params: baseline }];

  for (const mut of mutations) {
    console.log(`  ${mut.label}...`);
    const result = runBacktestWithParams(mut.params);
    const score = scoreMutation(result);
    results.push({ label: mut.label, result, score, params: mut.params });
    console.log(`    Sharpe=${result.results.sharpeRatio}, Return=${result.results.totalReturn}%, DD=${result.results.maxDrawdown}%, WR=${result.results.winRate}%, Score=${score.toFixed(1)}`);
    if (score > bestResult.score) {
      bestResult = { result, score, label: mut.label, params: mut.params };
    }
  }

  console.log('\n───────────────────────────────────────────');
  if (bestResult.label !== 'baseline') {
    console.log(`✅ PROMOTED: ${bestResult.label}`);
    console.log(`   Params:`, JSON.stringify(bestResult.params, null, 2));
    console.log(`   Score: ${baselineScore.toFixed(1)} → ${bestResult.score.toFixed(1)}`);
  } else {
    console.log('➖ No improvement found. Keeping baseline.');
  }

  const genNum = (() => {
    try { const e = JSON.parse(readFileSync(EVOLUTION_LOG, 'utf-8')); return (e.generation || 0) + 1; }
    catch { return 1; }
  })();

  const logEntry = {
    generation: genNum,
    timestamp: new Date().toISOString(),
    source: hasLLM ? 'llm' : 'random',
    baseline: { params: baseline, results: baselineResult.results, score: baselineScore },
    mutations: results.filter(r => r.label !== 'baseline').map(r => ({
      label: r.label, params: r.params, results: r.result.results, score: r.score,
    })),
    promoted: bestResult.label !== 'baseline' ? bestResult.label : null,
    promotedParams: bestResult.params,
  };

  const existingLog = (() => {
    try { return JSON.parse(readFileSync(EVOLUTION_LOG, 'utf-8')); }
    catch { return { entries: [] }; }
  })();
  existingLog.entries = existingLog.entries || [];
  existingLog.entries.push(logEntry);
  existingLog.generation = genNum;
  writeFileSync(EVOLUTION_LOG, JSON.stringify(existingLog, null, 2));
  console.log(`\n  Logged to data/evolution_log.json (gen ${genNum}, source: ${hasLLM ? 'LLM' : 'random'})`);
  console.log('═══════════════════════════════════════════\n');

  return bestResult;
}

if (process.argv[1] && (process.argv[1].endsWith('evolve.js') || process.argv[1].endsWith('evolve'))) {
  const generations = parseInt(process.argv[2]) || 1;
  (async () => {
    let best;
    for (let g = 0; g < generations; g++) {
      if (generations > 1) console.log(`\n========== GENERATION ${g + 1}/${generations} ==========\n`);
      best = await evolve();
    }
    if (best) {
      console.log('\n═══════════════════════════════════════════');
      console.log('  BEST PARAMS ACROSS ALL GENERATIONS');
      console.log('═══════════════════════════════════════════');
      console.log(JSON.stringify(best.params, null, 2));
      console.log(`Returns: ${best.result.results.totalReturn}%`);
      console.log(`Sharpe: ${best.result.results.sharpeRatio}`);
      console.log(`Max DD: ${best.result.results.maxDrawdown}%`);
      console.log(`Win rate: ${best.result.results.winRate}%`);
      console.log(`Trades: ${best.result.results.totalTrades}`);
    }
  })().catch(err => { console.error('Evolution failed:', err); process.exit(1); });
}
