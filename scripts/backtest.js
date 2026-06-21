import { scoreAll } from '../src/strategy/quant_score.js';
import { evaluate } from '../src/strategy/perps_strategy.js';
import { calculate } from '../src/strategy/kelly.js';
import { loadSavedData } from './fetch-data.js';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_CONFIG = {
  initialCapital: 1000,
  intervalHours: 8,
  periods: 540,
  txnCost: 0.50,
  gasCost: 0.01,
  seed: 42,
  dataSource: 'auto',
};

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function generateMarketData(periods, seed) {
  console.warn('[Backtest] WARNING: Using SYNTHETIC data. Run `node scripts/fetch-data.js` for real market data.\n');
  const rng = mulberry32(seed);
  const data = [];
  let btcPrice = 65000;
  let ethPrice = 3500;
  let bnbPrice = 580;
  let btcVol = 0;

  for (let i = 0; i < periods; i++) {
    btcVol += (rng() - 0.5) * 0.06;
    btcVol = Math.max(0.3, Math.min(3, btcVol));
    const btcRet = (rng() - 0.5 + btcVol * 0.02) * 0.02;
    btcPrice *= (1 + btcRet);
    const ethBeta = 0.8 + rng() * 0.4;
    const ethRet = btcRet * ethBeta + (rng() - 0.5) * 0.015;
    ethPrice *= (1 + ethRet);
    const bnbBeta = 0.6 + rng() * 0.5;
    const bnbRet = btcRet * bnbBeta + (rng() - 0.5) * 0.02;
    bnbPrice *= (1 + bnbRet);

    data.push({
      timestamp: new Date(Date.now() - (periods - i) * DEFAULT_CONFIG.intervalHours * 3600000).toISOString(),
      prices: [
        { symbol: 'BTC', price: Math.round(btcPrice * 100) / 100, percentChange1h: btcRet * 100, percentChange24h: (rng() - 0.5) * 6, volume24h: 20 + rng() * 30 },
        { symbol: 'ETH', price: Math.round(ethPrice * 100) / 100, percentChange1h: ethRet * 100, percentChange24h: (rng() - 0.5) * 7, volume24h: 10 + rng() * 20 },
        { symbol: 'BNB', price: Math.round(bnbPrice * 100) / 100, percentChange1h: bnbRet * 100, percentChange24h: (rng() - 0.5) * 8, volume24h: 2 + rng() * 5 },
      ],
      fundingRates: [
        { symbol: 'BTC', fundingRate: (rng() - 0.48) * 0.0004 },
        { symbol: 'ETH', fundingRate: (rng() - 0.48) * 0.0004 },
        { symbol: 'BNB', fundingRate: (rng() - 0.48) * 0.0004 },
      ],
      fearGreed: { value: Math.round(20 + Math.sin(data.length / 30) * 30 + (rng() - 0.5) * 20) },
      trending: [],
    });
  }
  return data;
}

function loadMarketData(config, verbose) {
  if (config.dataSource === 'synthetic') {
    if (verbose) console.log('  [Backtest] Skipping cache (dataSource=synthetic)');
    return null;
  }

  if (verbose) console.log('  [Backtest] Checking for cached market data...');
  const saved = loadSavedData(verbose);
  if (saved && saved.length > 0) {
    const sliced = saved.slice(0, config.periods);
    if (verbose) console.log(`  [Backtest] ✓ Loaded ${sliced.length} slices from cached market-data/\n`);
    return sliced;
  }

  const dataPath = resolve(__dirname, '../data/market_data.json');
  if (verbose) console.log(`  [Backtest] Checking ${dataPath}...`);
  if (existsSync(dataPath)) {
    try {
      const raw = JSON.parse(readFileSync(dataPath, 'utf-8'));
      const d = raw.data || raw;
      if (Array.isArray(d) && d.length > 0) {
        const sliced = d.slice(0, config.periods);
        if (verbose) console.log(`  [Backtest] ✓ Loaded ${sliced.length} slices\n`);
        return sliced;
      }
    } catch {
      if (verbose) console.log('  [Backtest] ✗ Parse failed');
    }
  }

  if (verbose) console.log('  [Backtest] ✗ No cached data, generating synthetic...\n');
  return null;
}

function computeSharpe(returns, rf = 0.02, periodsPerYear = 2190) {
  if (returns.length < 2) return 0;
  const mu = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mu) ** 2, 0) / (returns.length - 1);
  if (variance === 0) return 0;
  const sigma = Math.sqrt(variance);
  if (sigma === 0) return 0;
  return ((mu * periodsPerYear) - rf) / (sigma * Math.sqrt(periodsPerYear));
}

function computeMaxDrawdown(equity) {
  let peak = equity[0];
  let maxDd = 0;
  for (const val of equity) {
    if (val > peak) peak = val;
    const dd = (peak - val) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

export function runBacktest(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const evoParams = options.evoParams || {};

  if (!options.quiet) {
    console.log('');
    console.log('══════════════════════════════════════════════════════');
    console.log('  Renaissance Strategy Engine — Running Backtest');
    console.log('══════════════════════════════════════════════════════');
    console.log(`  Periods:       ${config.periods}`);
    console.log(`  Interval:      ${config.intervalHours}h`);
    console.log(`  Initial Cap:   $${config.initialCapital}`);
    console.log(`  Seed:          ${config.seed}`);
    console.log(`  Stop Loss:     ${evoParams.stopLossPct || 5}%`);
    console.log(`  Take Profit:   ${evoParams.takeProfitPct || 5}%`);
    console.log(`  Leverage:      ${Math.min(evoParams.maxLeverage || 5, 5)}x`);
    console.log(`  Kelly Frac:    ${evoParams.kellyFraction || 0.25}`);
    console.log(`  RSI OB/OS:     ${evoParams.rsiOverboughtThreshold || 70} / ${evoParams.rsiOversoldThreshold || 30}`);
    console.log(`  Max Drawdown:  ${evoParams.maxDrawdown || 30}% halt`);
    console.log('──────────────────────────────────────────────────────\n');
  }

  let marketData = options.marketData;
  if (!marketData) {
    marketData = loadMarketData(config, !options.quiet);
  }
  if (!marketData) {
    console.log('  [Backtest] Generating synthetic price series in memory (no API calls needed)...');
    marketData = generateMarketData(config.periods, config.seed);
    console.log(`  [Backtest] ✓ Generated ${marketData.length} synthetic bars\n`);
  }

  const stopLossPct = (evoParams.stopLossPct || 5) / 100;
  const takeProfitPct = (evoParams.takeProfitPct || 5) / 100;
  const rsiOverbought = evoParams.rsiOverboughtThreshold || 70;
  const rsiOversold = evoParams.rsiOversoldThreshold || 30;
  const confThreshold = evoParams.confidenceThreshold || 0.6;
  const kellyFraction = evoParams.kellyFraction || 0.25;
  const volDampeningFloor = evoParams.volDampeningFloor || 0.2;
  const maxLev = Math.min(evoParams.maxLeverage || 5, 5);

  let portfolio = config.initialCapital;
  let position = null;
  const equity = [portfolio];
  const returns = [];
  const trades = [];
  let tradesToday = 0;
  let lastTradeDay = -1;
  let drawdownHalted = false;

  const logInterval = Math.max(1, Math.floor(marketData.length / 20));
  const startTime = Date.now();

  for (let i = 0; i < marketData.length; i++) {
    const slice = marketData[i];
    const currentDay = Math.floor(i / (24 / config.intervalHours));
    if (currentDay !== lastTradeDay) { tradesToday = 0; lastTradeDay = currentDay; }

    if (!options.quiet && i > 0 && i % logInterval === 0) {
      const pct = (i / marketData.length * 100).toFixed(0);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const eq = equity[equity.length - 1] || portfolio;
      const chg = ((eq - config.initialCapital) / config.initialCapital * 100).toFixed(2);
      console.log(`  [${pct}%] period ${i}/${marketData.length}  equity=$${eq.toFixed(2)}  return=${chg}%  trades=${trades.length}  pos=${position ? position.symbol + ' ' + position.direction : 'none'}  (${elapsed}s)`);
    }

    const cmcData = {
      prices: slice.prices,
      fundingRates: slice.fundingRates,
      fearGreed: slice.fearGreed,
      trending: slice.trending || [],
      volatility: (slice.prices || [])
        .filter(p => p.percentChange24h != null)
        .reduce((a, b) => a + Math.abs(b.percentChange24h), 0) / (slice.prices?.length || 1) || 20,
      selectedToken: null,
    };

    const scores = scoreAll(cmcData, { asset: 'ETH', direction: 'LONG' });
    const topToken = (scores && scores.length > 0 && scores[0].score > 0) ? scores[0] : null;
    const targetSymbol = topToken ? topToken.symbol : 'ETH';

    const strategy = {
      asset: targetSymbol,
      direction: 'LONG',
      exitConditions: { rsiOverbought, rsiOversold, trailingStop: 'ATR' },
      risk: { maxLeverage: maxLev, maxPerTrade: 200, maxDrawdown: 30, minConfidence: confThreshold },
    };

    const signal = evaluate(cmcData, strategy);

    if (computeMaxDrawdown(equity) > 0.3 && i > 20) drawdownHalted = true;

    if (drawdownHalted) {
      if (position) {
        const p = slice.prices.find(pr => pr.symbol === position.symbol)?.price || slice.prices[0]?.price;
        const pnl = (p - position.entryPrice) / position.entryPrice * position.leverage * position.sizeUsd - config.txnCost - config.gasCost;
        portfolio += position.sizeUsd + pnl;
        trades.push({ ...position, exitPrice: p, pnl, exitReason: 'DRAWDOWN_HALT' });
        if (!options.quiet) console.log(`  ╔══ CLOSE #${trades.length} ═══════════════════════════════╗\n  ║ ${position.symbol} ${position.direction}  entry=$${position.entryPrice}  exit=$${p.toFixed(2)}  pnl=$${pnl.toFixed(2)}  REASON=DRAWDOWN_HALT\n  ╚══════════════════════════════════════════╝`);
        position = null;
      }
      equity.push(portfolio);
      continue;
    }

    let shouldExit = false;
    let exitReason = '';
    if (position) {
      const cp = slice.prices.find(pr => pr.symbol === position.symbol)?.price;
      if (cp) {
        const pnlPct = (cp - position.entryPrice) / position.entryPrice;
        if (pnlPct <= -stopLossPct) { shouldExit = true; exitReason = 'STOP_LOSS'; }
        else if (pnlPct >= takeProfitPct) { shouldExit = true; exitReason = 'TAKE_PROFIT'; }
      }
      if (i - position.entryIndex >= 6) { shouldExit = true; exitReason = exitReason || 'TIME_STOP'; }
    }

    if (shouldExit && position) {
      const ep = slice.prices.find(pr => pr.symbol === position.symbol)?.price || slice.prices[0]?.price;
      const pnl = (ep - position.entryPrice) / position.entryPrice * position.leverage * position.sizeUsd - config.txnCost - config.gasCost;
      portfolio += position.sizeUsd + pnl;
      trades.push({ ...position, exitPrice: ep, pnl, exitReason });
      if (!options.quiet) console.log(`  ╔══ CLOSE #${trades.length} ═══════════════════════════════╗\n  ║ ${position.symbol} ${position.direction}  entry=$${position.entryPrice}  exit=$${ep.toFixed(2)}  pnl=$${pnl.toFixed(2)}  REASON=${exitReason}\n  ╚══════════════════════════════════════════╝`);
      position = null;
    }

    if (!position && signal && signal.direction && signal.confidence >= confThreshold && tradesToday < 1) {
      const target = slice.prices.find(pr => pr.symbol === targetSymbol);
      const price = target?.price || slice.prices[0]?.price || 3500;
      const vol = cmcData.volatility || 20;

      const kellyResult = calculate(
        { action: 'BUY', confidence: signal.confidence, winRate: 0.55, avgWin: 0.12, avgLoss: 0.05, kellyFraction, leverage: maxLev, volDampeningFloor },
        portfolio, vol
      );

      let sizePct = kellyResult.sizePct || 5;
      if (sizePct > 5) sizePct = 5;
      const sizeUsd = Math.min(portfolio * (sizePct / 100), portfolio * 0.1);
      if (sizeUsd > 10) {
        position = {
          symbol: targetSymbol,
          direction: signal.direction,
          entryPrice: price,
          sizeUsd,
          leverage: maxLev,
          entryIndex: i,
          confidence: signal.confidence,
        };
        tradesToday++;
        if (!options.quiet) {
          const sig = signal.reason || '';
          console.log(`  ╔══ OPEN #${trades.length + 1} ═══════════════════════════════╗\n  ║ ${position.symbol} ${position.direction}  entry=$${price}  size=$${sizeUsd.toFixed(2)}  lev=${maxLev}x  conf=${signal.confidence}\n  ║ ${sig}\n  ╚══════════════════════════════════════════╝`);
        }
      }
    }

    equity.push(position
      ? portfolio + (position.sizeUsd * (((slice.prices.find(pr => pr.symbol === position.symbol)?.price || slice.prices[0]?.price) / position.entryPrice - 1) * position.leverage))
      : portfolio);
    if (i > 0) returns.push((equity[equity.length - 1] - equity[equity.length - 2]) / equity[equity.length - 2]);
  }

  const finalEquity = equity[equity.length - 1];
  const totalReturn = ((finalEquity - config.initialCapital) / config.initialCapital) * 100;
  const sharpe = computeSharpe(returns);
  const maxDd = computeMaxDrawdown(equity) * 100;
  const winningTrades = trades.filter(t => t.pnl > 0).length;
  const totalTrades = trades.length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!options.quiet) {
    console.log('');
    console.log('══════════════════════════════════════════════════════');
    console.log('  Backtest Complete');
    console.log('══════════════════════════════════════════════════════');
    console.log(`  Periods:       ${marketData.length} bars @ ${config.intervalHours}h`);
    console.log(`  Duration:      ${elapsed}s`);
    console.log(`  Initial Cap:   $${config.initialCapital}`);
    console.log(`  Final Equity:  $${finalEquity.toFixed(2)}`);
    console.log(`  Total Return:  ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`);
    console.log(`  Sharpe Ratio:  ${sharpe.toFixed(2)}`);
    console.log(`  Max Drawdown:  ${(maxDd).toFixed(2)}%`);
    console.log(`  Win Rate:      ${totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(1) : 0}% (${winningTrades}W / ${totalTrades - winningTrades}L)`);
    console.log('──────────────────────────────────────────────────────\n');
  }

  return {
    config: {
      initialCapital: config.initialCapital,
      periods: marketData.length,
      intervalHours: config.intervalHours,
      txnCost: config.txnCost,
      gasCost: config.gasCost,
      seed: config.seed,
      dataSource: marketData.length > 0 && marketData[0].prices ? (marketData[0].prices[0]?.volume24h > 1000000 ? 'binance' : 'synthetic') : 'synthetic',
    },
    results: {
      totalReturn: Math.round(totalReturn * 100) / 100,
      sharpeRatio: Math.round(sharpe * 100) / 100,
      maxDrawdown: Math.round(maxDd * 100) / 100,
      winRate: totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 10000) / 100 : 0,
      totalTrades, winningTrades, losingTrades: totalTrades - winningTrades,
      finalEquity: Math.round(finalEquity * 100) / 100,
    },
    equity: equity.map(e => Math.round(e * 100) / 100),
    trades: trades.map((t, i) => ({
      trade: i + 1, symbol: t.symbol, direction: t.direction,
      entryPrice: Math.round(t.entryPrice * 100) / 100,
      exitPrice: Math.round(t.exitPrice * 100) / 100,
      sizeUsd: Math.round(t.sizeUsd * 100) / 100, leverage: t.leverage,
      pnl: Math.round(t.pnl * 100) / 100, exitReason: t.exitReason,
    })),
  };
}

if (process.argv[1] && (process.argv[1].endsWith('backtest.js') || process.argv[1].endsWith('backtest'))) {
  let evoParams = {};
  const evoLog = resolve(__dirname, '../data/evolution_log.json');
  if (existsSync(evoLog)) {
    try {
      const log = JSON.parse(readFileSync(evoLog, 'utf-8'));
      const entries = log.entries || [];
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].promotedParams) { evoParams = entries[i].promotedParams; break; }
      }
    } catch { }
  }

  const result = runBacktest({
    periods: parseInt(process.argv[2]) || 540,
    initialCapital: parseFloat(process.argv[3]) || 1000,
    seed: parseInt(process.argv[4]) || 42,
    dataSource: process.argv[5] || 'auto',
    evoParams,
  });
  console.log(JSON.stringify(result, null, 2));
}
