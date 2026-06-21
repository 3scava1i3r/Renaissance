import { runBacktest } from './backtest.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });
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

async function tryChat(provider, url, headers, body) {
  try {
    const { default: axios } = await import('axios');
    const resp = await axios.post(url, body, { headers, timeout: 30000, validateStatus: () => true });
    const size = JSON.stringify(resp.data).length;
    console.log('    [' + provider + '] POST ' + url);
    console.log('    [' + provider + '] HTTP ' + resp.status + ', ' + size + ' bytes response');
    if (resp.status !== 200) {
      const msg = resp.data?.error?.message || resp.statusText;
      console.log('    [' + provider + '] Error: HTTP ' + resp.status + ' \u2014 ' + (typeof msg === 'object' ? JSON.stringify(msg) : msg));
      return null;
    }
    return resp.data;
  } catch (err) {
    console.log('    [' + provider + '] Request failed: ' + err.message);
    return null;
  }
}

function parseArrayResponse(provider, data) {
  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text
    || data?.choices?.[0]?.message?.content
    || data?.content?.[0]?.text
    || '');
  const snippet = text.slice(0, 100).replace(/\n/g, ' ');
  console.log('    [' + provider + '] Response starts: "' + snippet + '..."');
  const matches = text.match(/\[[\s\S]*?\]/);
  if (!matches) {
    console.log('    [' + provider + '] No JSON array found in response');
    return [];
  }
  try {
    const parsed = JSON.parse(matches[0]);
    if (!Array.isArray(parsed)) {
      console.log('    [' + provider + '] Response is not an array');
      return [];
    }
    return parsed;
  } catch (e) {
    console.log('    [' + provider + '] Failed to parse JSON: ' + e.message);
    return [];
  }
}


async function generateLLMMutations(params) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const veniceKey = process.env.VENICE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  console.log('  [Evolve] LLM providers configured:');
  console.log('    Gemini:    ' + (geminiKey ? geminiKey.slice(0, 8) + '...' : 'none'));
  console.log('    NVIDIA:    ' + (nvidiaKey ? nvidiaKey.slice(0, 8) + '...' : 'none'));
  console.log('    Venice:    ' + (veniceKey ? veniceKey.slice(0, 8) + '...' : 'none'));
  console.log('    Anthropic: ' + (anthropicKey ? anthropicKey.slice(0, 8) + '...' : 'none'));
  console.log('');

  const prompt = 'You are a strategy optimizer. Given these current parameters, suggest exactly 3 different mutations with different risk profiles.\n\n'
    + 'Current:\n'
    + '  rsiOversoldThreshold=' + params.rsiOversoldThreshold + '\n'
    + '  rsiOverboughtThreshold=' + params.rsiOverboughtThreshold + '\n'
    + '  confidenceThreshold=' + params.confidenceThreshold + '\n'
    + '  kellyFraction=' + params.kellyFraction + '\n'
    + '  volDampeningFloor=' + params.volDampeningFloor + '\n'
    + '  maxLeverage=' + params.maxLeverage + '\n'
    + '  stopLossPct=' + params.stopLossPct + '\n'
    + '  takeProfitPct=' + params.takeProfitPct + '\n\n'
    + 'Mutation 1 (conservative): reduce max drawdown while keeping Sharpe > 1.0\n'
    + 'Mutation 2 (aggressive): increase win rate and total return\n'
    + 'Mutation 3 (balanced): improve risk-adjusted returns (lower drawdown, higher Sharpe)\n\n'
    + 'Return ONLY a JSON array of exactly 3 objects, one per mutation, with NO extra text.\n'
    + 'Each object must have a "label" ("conservative", "aggressive", or "balanced") plus all 8 numeric keys:\n'
    + '  rsiOversoldThreshold: 15-45,\n'
    + '  rsiOverboughtThreshold: 55-85,\n'
    + '  confidenceThreshold: 0.4-0.8,\n'
    + '  kellyFraction: 0.1-0.5,\n'
    + '  volDampeningFloor: 0.1-0.5,\n'
    + '  maxLeverage: 1-5,\n'
    + '  stopLossPct: 2-15,\n'
    + '  takeProfitPct: 2-15\n\n'
    + 'Example:\n'
    + '[\n'
    + '  { "label": "conservative", "rsiOversoldThreshold": 20, "rsiOverboughtThreshold": 65, "confidenceThreshold": 0.5, "kellyFraction": 0.15, "volDampeningFloor": 0.3, "maxLeverage": 3, "stopLossPct": 3, "takeProfitPct": 3 },\n'
    + '  { "label": "aggressive", "rsiOversoldThreshold": 35, "rsiOverboughtThreshold": 75, "confidenceThreshold": 0.6, "kellyFraction": 0.35, "volDampeningFloor": 0.15, "maxLeverage": 5, "stopLossPct": 5, "takeProfitPct": 5 },\n'
    + '  { "label": "balanced", "rsiOversoldThreshold": 25, "rsiOverboughtThreshold": 70, "confidenceThreshold": 0.55, "kellyFraction": 0.25, "volDampeningFloor": 0.2, "maxLeverage": 4, "stopLossPct": 4, "takeProfitPct": 4 }\n'
    + ']';

  console.log('  [Evolve] Sending 3 prompts as 1 batch request');
  console.log('  ──────────────────────────────────────────');

  let rawData = null;
  let usedProvider = '';

  if (geminiKey) {
    const models = ['gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-2.0-flash'];
    for (const model of models) {
      console.log('    [Gemini] Trying model: ' + model);
      rawData = await tryChat('Gemini',
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
        { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
        { contents: [{ role: 'user', parts: [{ text: prompt }] }] }
      );
      if (rawData) { usedProvider = 'Gemini'; break; }
    }
  } else {
    console.log('    [Gemini] No API key configured');
  }

  if (!rawData && nvidiaKey) {
    console.log('    [NVIDIA] Trying...');
    rawData = await tryChat('NVIDIA',
      'https://integrate.api.nvidia.com/v1/chat/completions',
      { 'Authorization': 'Bearer ' + nvidiaKey, 'Content-Type': 'application/json' },
      { model: 'nvidia/llama-3.1-nemotron-70b-instruct', messages: [{ role: 'user', content: prompt }], temperature: 0.8 }
    );
    if (rawData) usedProvider = 'NVIDIA';
  }

  if (!rawData && veniceKey) {
    console.log('    [Venice] Trying...');
    rawData = await tryChat('Venice',
      'https://api.venice.ai/api/v1/chat/completions',
      { 'Authorization': 'Bearer ' + veniceKey, 'Content-Type': 'application/json' },
      { model: 'llama-3.3-70b', messages: [{ role: 'user', content: prompt }], temperature: 0.8 }
    );
    if (rawData) usedProvider = 'Venice';
  }

  if (!rawData && anthropicKey) {
    console.log('    [Anthropic] Trying...');
    rawData = await tryChat('Anthropic',
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      { model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }
    );
    if (rawData) usedProvider = 'Anthropic';
  }

  if (!rawData) {
    console.log('  [Evolve] All providers failed\n');
    return [];
  }

  const parsed = parseArrayResponse(usedProvider, rawData);
  const mutations = [];

  for (const item of parsed) {
    const label = 'llm_' + (item.label || 'mutation');
    const cleaned = {};
    for (const key of Object.keys(params)) {
      cleaned[key] = item[key] !== undefined ? item[key] : params[key];
    }
    mutations.push({ params: cleaned, label });
    console.log('    [Evolve] ' + label + ' \u2014 stop=' + cleaned.stopLossPct + '% take=' + cleaned.takeProfitPct + '% kelly=' + cleaned.kellyFraction + ' RSI=' + cleaned.rsiOversoldThreshold + '/' + cleaned.rsiOverboughtThreshold);
  }

  console.log('  [Evolve] ' + usedProvider + ' returned ' + mutations.length + ' / 3 mutations');
  console.log('');

  await new Promise(r => setTimeout(r, 1000));
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

  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasNvidia = !!process.env.NVIDIA_API_KEY;
  const hasVenice = !!process.env.VENICE_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasLLM = hasGemini || hasNvidia || hasVenice || hasAnthropic;

  let mutations = [];
  if (hasLLM) {
    const providers = [];
    if (hasGemini) providers.push('Gemini');
    if (hasNvidia) providers.push('NVIDIA');
    if (hasVenice) providers.push('Venice');
    if (hasAnthropic) providers.push('Anthropic');
    console.log('  [Evolve] Providers with keys: ' + providers.join(', ') + '\n');

    mutations = await generateLLMMutations(baseline);
    if (mutations.length === 0) {
      console.log('  [Evolve] LLM returned 0 mutations — all providers failed. Falling back to random.\n');
      mutations = generateRandomMutations(baseline);
    } else {
      console.log('  [Evolve] LLM generated ' + mutations.length + ' mutations successfully\n');
    }
  } else {
    console.log('  [Evolve] No LLM API keys found in environment. Using random mutations.\n');
    mutations = generateRandomMutations(baseline);
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
