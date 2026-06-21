import { scoreAll } from '../src/strategy/quant_score.js';
import { evaluate } from '../src/strategy/perps_strategy.js';
import { calculate } from '../src/strategy/kelly.js';

const DEFAULT_CONFIG = {
  initialCapital: 1000,
  intervalHours: 4,
  periods: 540,
  txnCost: 0.50,
  gasCost: 0.01,
  seed: 42,
};

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function generateMarketData(periods, seed) {
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

    const fundingRate = (rng() - 0.48) * 0.0004;
    const fearGreedValue = Math.round(20 + Math.sin(i / 30) * 30 + (rng() - 0.5) * 20);

    data.push({
      timestamp: new Date(Date.now() - (periods - i) * DEFAULT_CONFIG.intervalHours * 3600000).toISOString(),
      prices: [
        { symbol: 'BTC', price: Math.round(btcPrice * 100) / 100, percentChange1h: btcRet * 100, percentChange24h: (rng() - 0.5) * 6, volume24h: 20 + rng() * 30 },
        { symbol: 'ETH', price: Math.round(ethPrice * 100) / 100, percentChange1h: ethRet * 100, percentChange24h: (rng() - 0.5) * 7, volume24h: 10 + rng() * 20 },
        { symbol: 'BNB', price: Math.round(bnbPrice * 100) / 100, percentChange1h: bnbRet * 100, percentChange24h: (rng() - 0.5) * 8, volume24h: 2 + rng() * 5 },
      ],
      fundingRates: [
        { symbol: 'BTC', fundingRate },
        { symbol: 'ETH', fundingRate: fundingRate + (rng() - 0.5) * 0.0001 },
        { symbol: 'BNB', fundingRate: fundingRate + (rng() - 0.5) * 0.00015 },
      ],
      fearGreed: { value: fearGreedValue },
      trending: [],
    });
  }
  return data;
}

function computeSharpe(returns, rf = 0.02, periodsPerYear = 2190) {
  if (returns.length < 2) return 0;
  const mu = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mu) ** 2, 0) / (returns.length - 1);
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
  const marketData = options.marketData || generateMarketData(config.periods, config.seed);

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

  const strategy = {
    asset: 'ETH',
    direction: 'LONG',
    exitConditions: { rsiOverbought, rsiOversold, trailingStop: 'ATR' },
    risk: { maxLeverage: maxLev, maxPerTrade: 200, maxDrawdown: 30 },
  };

  for (let i = 0; i < marketData.length; i++) {
    const slice = marketData[i];
    const currentDay = Math.floor(i / (24 / config.intervalHours));

    if (currentDay !== lastTradeDay) {
      tradesToday = 0;
      lastTradeDay = currentDay;
    }

    const cmcData = {
      prices: slice.prices,
      fundingRates: slice.fundingRates,
      fearGreed: slice.fearGreed,
      trending: slice.trending || [],
      volatility: (slice.prices || [])
        .filter(p => p.percentChange24h != null)
        .reduce((a, b) => a + Math.abs(b.percentChange24h), 0) / (slice.prices?.length || 1) || 20,
      selectedToken: slice.prices?.[1] || null,
    };

    const scores = scoreAll(cmcData, strategy);
    const signal = evaluate(cmcData, strategy);

    if (computeMaxDrawdown(equity) > 0.3 && i > 20) drawdownHalted = true;

    if (drawdownHalted) {
      if (position) {
        const p = slice.prices.find(p => p.symbol === position.symbol)?.price || slice.prices[1]?.price;
        const pnl = (p - position.entryPrice) / position.entryPrice * position.leverage * position.sizeUsd - config.txnCost - config.gasCost;
        portfolio += position.sizeUsd + pnl;
        trades.push({ ...position, exitPrice: p, pnl, exitReason: 'DRAWDOWN_HALT' });
        position = null;
      }
      equity.push(portfolio);
      continue;
    }

    let shouldExit = false;
    let exitReason = '';
    if (position) {
      const cp = slice.prices.find(p => p.symbol === position.symbol)?.price;
      if (cp) {
        const pnlPct = (cp - position.entryPrice) / position.entryPrice;
        if (pnlPct <= -stopLossPct) { shouldExit = true; exitReason = 'STOP_LOSS'; }
        else if (pnlPct >= takeProfitPct) { shouldExit = true; exitReason = 'TAKE_PROFIT'; }
      }
      if (i - position.entryIndex >= 6) { shouldExit = true; exitReason = exitReason || 'TIME_STOP'; }
    }

    if (shouldExit && position) {
      const ep = slice.prices.find(p => p.symbol === position.symbol)?.price || slice.prices[1]?.price;
      const pnl = (ep - position.entryPrice) / position.entryPrice * position.leverage * position.sizeUsd - config.txnCost - config.gasCost;
      portfolio += position.sizeUsd + pnl;
      trades.push({ ...position, exitPrice: ep, pnl, exitReason });
      position = null;
    }

    if (!position && signal && signal.direction && signal.confidence >= confThreshold && tradesToday < 1) {
      const eth = slice.prices.find(p => p.symbol === 'ETH');
      const price = eth?.price || 3500;
      const vol = cmcData.volatility || 20;

      const kellyResult = calculate(
        { action: 'BUY', confidence: signal.confidence, winRate: 0.55, avgWin: 0.12, avgLoss: 0.05 },
        portfolio, vol
      );

      let sizePct = kellyResult.sizePct || 5;
      sizePct = Math.max(2, Math.min(20, sizePct * (kellyFraction / 0.25)));
      const volAdj = Math.max(volDampeningFloor, 1 - (vol * 0.5 / 10));
      sizePct *= volAdj;
      sizePct = Math.max(2, Math.min(20, sizePct));

      const sizeUsd = Math.min(portfolio * (sizePct / 100), portfolio * 0.2);
      if (sizeUsd > 10) {
        position = {
          symbol: 'ETH',
          direction: signal.direction,
          entryPrice: price,
          sizeUsd,
          leverage: maxLev,
          entryIndex: i,
          confidence: signal.confidence,
        };
        tradesToday++;
      }
    }

    equity.push(position
      ? portfolio + (position.sizeUsd * ((slice.prices.find(p => p.symbol === 'ETH')?.price || 3500) / position.entryPrice - 1) * position.leverage)
      : portfolio);
    if (i > 0) returns.push((equity[equity.length - 1] - equity[equity.length - 2]) / equity[equity.length - 2]);
  }

  const finalEquity = equity[equity.length - 1];
  const totalReturn = ((finalEquity - config.initialCapital) / config.initialCapital) * 100;
  const returnArr = returns;
  const sharpe = computeSharpe(returnArr);
  const maxDd = computeMaxDrawdown(equity) * 100;
  const winningTrades = trades.filter(t => t.pnl > 0).length;
  const totalTrades = trades.length;

  return {
    config: { initialCapital: config.initialCapital, periods: marketData.length, intervalHours: config.intervalHours, txnCost: config.txnCost, gasCost: config.gasCost, seed: config.seed },
    results: {
      totalReturn: Math.round(totalReturn * 100) / 100,
      sharpeRatio: Math.round(sharpe * 100) / 100,
      maxDrawdown: Math.round(maxDd * 100) / 100,
      winRate: totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 10000) / 100 : 0,
      totalTrades, winningTrades, losingTrades: totalTrades - winningTrades,
      finalEquity: Math.round(finalEquity * 100) / 100,
    },
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
  const { existsSync, readFileSync } = await import('fs');
  const { resolve, dirname } = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = dirname(fileURLToPath(import.meta.url));

  let evoParams = {};
  const evoLog = resolve(__dirname, '../data/evolution_log.json');
  if (existsSync(evoLog)) {
    try {
      const log = JSON.parse(readFileSync(evoLog, 'utf-8'));
      const entries = log.entries || [];
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].promotedParams) {
          evoParams = entries[i].promotedParams;
          break;
        }
      }
    } catch {}
  }

  const result = runBacktest({
    periods: parseInt(process.argv[2]) || 540,
    initialCapital: parseFloat(process.argv[3]) || 1000,
    seed: parseInt(process.argv[4]) || 42,
    evoParams,
  });
  console.log(JSON.stringify(result, null, 2));
}
