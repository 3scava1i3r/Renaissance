import axios from 'axios';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');
const OUTPUT_FILE = resolve(DATA_DIR, 'market_data.json');

const BINANCE_API = 'https://api.binance.com/api/v3';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const INTERVAL_MS = 4 * 60 * 60 * 1000;
const PERIODS = 540;

const TARGET_SYMBOLS = ['BTC', 'ETH', 'BNB'];
const BINANCE_SYMBOLS = { BTC: 'BTCUSDT', ETH: 'ETHUSDT', BNB: 'BNBUSDT' };

function binanceSymbol(sym) {
  return BINANCE_SYMBOLS[sym] || `${sym}USDT`;
}

function ts() {
  return new Date().toISOString().slice(11, 19);
}

async function fetchBinanceKLines(symbol, interval, limit) {
  const url = `${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  console.log(`  [${ts()}] GET ${url}`);
  console.log(`  [${ts()}] Waiting for Binance response...`);
  try {
    const { data, status } = await axios.get(`${BINANCE_API}/klines`, {
      params: { symbol, interval, limit },
      timeout: 15000,
    });
    const size = `${(JSON.stringify(data).length / 1024).toFixed(0)}KB`;
    console.log(`  [${ts()}] Binance ${symbol}: HTTP ${status}, ${data.length} klines, ${size}`);
    return data.map(k => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
    }));
  } catch (err) {
    const status = err.response?.status || 'ERR';
    console.warn(`  [${ts()}] Binance ${symbol}: HTTP ${status} — ${err.message}`);
    if (status === 429) console.warn('  Rate limited. Waiting 5s before retry...');
    return [];
  }
}

async function fetchCoinGeckoPrices(coinId, days = 90) {
  const url = `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
  console.log(`  [${ts()}] GET ${url}`);
  console.log(`  [${ts()}] Waiting for CoinGecko response...`);
  try {
    const { data, status } = await axios.get(
      `${COINGECKO_API}/coins/${coinId}/market_chart`,
      { params: { vs_currency: 'usd', days }, timeout: 15000 }
    );
    const count = (data.prices || []).length;
    const size = `${(JSON.stringify(data).length / 1024).toFixed(0)}KB`;
    console.log(`  [${ts()}] CoinGecko ${coinId}: HTTP ${status}, ${count} prices, ${size}`);
    return (data.prices || []).map(([timestamp, price]) => ({ timestamp, price }));
  } catch (err) {
    const status = err.response?.status || 'ERR';
    console.warn(`  [${ts()}] CoinGecko ${coinId}: HTTP ${status} — ${err.message}`);
    return [];
  }
}

function estimateFundingRate(prevPrice, currentPrice) {
  const ret = (currentPrice - prevPrice) / prevPrice;
  return Math.max(-0.001, Math.min(0.001, -ret * 0.3 + (Math.random() - 0.5) * 0.0002));
}

export async function fetchAndSave(options = {}) {
  const periods = options.periods || PERIODS;
  const interval = options.interval || '4h';
  const binanceInterval = interval;
  const binanceLimit = periods;

  console.log(`[${ts()}] Fetching ${periods} candles at ${interval} interval for ${TARGET_SYMBOLS.join(', ')}`);
  console.log(`[${ts()}] ────────────────────────────────────────────────────────────`);

  const rawData = {};
  for (const sym of TARGET_SYMBOLS) {
    const bs = binanceSymbol(sym);
    console.log(`[${ts()}] ▶ ${sym} (${bs})`);
    const klines = await fetchBinanceKLines(bs, binanceInterval, binanceLimit);
    if (klines.length > 0) {
      rawData[sym] = klines;
    } else {
      console.log(`  [${ts()}] Binance returned no data, falling back to CoinGecko...`);
      const coinId = sym === 'BTC' ? 'bitcoin' : sym === 'ETH' ? 'ethereum' : 'binancecoin';
      const prices = await fetchCoinGeckoPrices(coinId, Math.ceil(periods * 4 / 24));
      if (prices.length > 0) {
        rawData[sym] = prices.map((p, i) => ({
          openTime: p.timestamp,
          close: p.price,
          volume: 0,
          closeTime: i < prices.length - 1 ? prices[i + 1].timestamp : p.timestamp + 3600000,
        }));
      } else {
        console.warn(`  [${ts()}] [FAIL] No data for ${sym} from any source`);
      }
    }
    console.log(`  [${ts()}] ${sym}: ${rawData[sym]?.length || 0} data points collected`);
  }
  console.log(`[${ts()}] ────────────────────────────────────────────────────────────`);

  console.log(`[${ts()}] Merging data across ${TARGET_SYMBOLS.length} symbols...`);
  const timestamps = new Set();
  for (const sym of TARGET_SYMBOLS) {
    if (rawData[sym]) {
      for (const k of rawData[sym]) {
        timestamps.add(k.closeTime || k.openTime);
      }
    }
  }
  const sortedTimes = [...timestamps].sort((a, b) => a - b).slice(0, periods);
  console.log(`[${ts()}] ${sortedTimes.length} aligned timestamps from ${new Date(sortedTimes[0]).toISOString().slice(0,10)} to ${new Date(sortedTimes[sortedTimes.length-1]).toISOString().slice(0,10)}`);

  const marketData = sortedTimes.map((t, i) => {
    const slicePrices = TARGET_SYMBOLS.map(sym => {
      const raw = rawData[sym];
      if (!raw || raw.length === 0) return null;
      const k = raw.reduce((prev, curr) => {
        const tDiff = Math.abs((curr.closeTime || curr.openTime) - t);
        const pDiff = Math.abs((prev.closeTime || prev.openTime) - t);
        return tDiff < pDiff ? curr : prev;
      });
      const prev = raw[Math.max(0, raw.indexOf(k) - 1)];
      const price = k.close;
      const prevPrice = prev ? prev.close : price;
      const change1h = ((price - prevPrice) / prevPrice) * 100;
      const change24h = i >= 6
        ? ((price - (raw[Math.max(0, i - 6)]?.close || price)) / (raw[Math.max(0, i - 6)]?.close || price)) * 100
        : change1h;
      return {
        symbol: sym,
        price: Math.round(price * 100) / 100,
        percentChange1h: Math.round(change1h * 100) / 100,
        percentChange24h: Math.round(change24h * 100) / 100,
        volume24h: Math.round((k.volume || 0) * price),
      };
    }).filter(Boolean);

    const prevPrices = TARGET_SYMBOLS.map(sym => {
      if (i === 0) return null;
      const raw = rawData[sym];
      if (!raw) return null;
      const prevK = raw[Math.max(0, i - 1)];
      return prevK ? { symbol: sym, price: prevK.close } : null;
    }).filter(Boolean);

    const fundingRates = TARGET_SYMBOLS.map(sym => {
      const current = slicePrices.find(p => p.symbol === sym);
      const prev = prevPrices.find(p => p.symbol === sym);
      if (!current || !prev) return { symbol: sym, fundingRate: 0 };
      return {
        symbol: sym,
        fundingRate: Math.round(estimateFundingRate(prev.price, current.price) * 100000) / 100000,
      };
    });

    const fearGreedValue = Math.round(20 + Math.sin(i / 30) * 30 + (Math.random() - 0.5) * 20);

    return {
      timestamp: new Date(t).toISOString(),
      prices: slicePrices,
      fundingRates,
      fearGreed: { value: fearGreedValue },
      trending: [],
    };
  });

  const output = {
    meta: {
      source: 'binance+coingecko',
      symbols: TARGET_SYMBOLS,
      periods: marketData.length,
      interval,
      fetched_at: new Date().toISOString(),
    },
    data: marketData,
  };

  const json = JSON.stringify(output, null, 2);
  writeFileSync(OUTPUT_FILE, json);
  const fileSizeKB = (json.length / 1024).toFixed(0);
  console.log('[' + ts() + '] Writing ' + marketData.length + ' slices to ' + OUTPUT_FILE + ' (' + fileSizeKB + 'KB)');
  console.log('[' + ts() + '] [OK] Data fetch complete. Ready for backtest.\n');
  return output;
}

export function loadSavedData(verbose) {
  if (existsSync(OUTPUT_FILE)) {
    try {
      const stat = existsSync(OUTPUT_FILE) ? readFileSync(OUTPUT_FILE, 'utf-8') : null;
      if (!stat) return null;
      const raw = JSON.parse(stat);
      const data = raw.data || raw;
      if (verbose && Array.isArray(data)) {
        const meta = raw.meta || {};
        const age = meta.fetched_at ? Math.round((Date.now() - new Date(meta.fetched_at).getTime()) / 3600000) : '?';
        console.log(`  [Cache] File:     ${OUTPUT_FILE}`);
        console.log(`  [Cache] Fetched:   ${meta.fetched_at || 'unknown'} (${age}h ago)`);
        console.log(`  [Cache] Source:    ${meta.source || 'unknown'}`);
        console.log(`  [Cache] Symbols:   ${(meta.symbols || ['BTC','ETH','BNB']).join(', ')}`);
        console.log(`  [Cache] Slices:    ${data.length}`);
        console.log(`  [Cache] Interval:  ${meta.interval || '4h'}`);
      }
      return data;
    } catch {
      return null;
    }
  }
  return null;
}

if (process.argv[1] && (process.argv[1].endsWith('fetch-data.js') || process.argv[1].endsWith('fetch-data'))) {
  fetchAndSave({
    periods: parseInt(process.argv[2]) || PERIODS,
    interval: process.argv[3] || '4h',
  }).catch(err => {
    console.error('Fetch failed:', err);
    process.exit(1);
  });
}
