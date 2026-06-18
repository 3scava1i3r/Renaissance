import { config } from '../config.js';
import axios from 'axios';

const CMC_API = 'https://pro-api.coinmarketcap.com/v1';

export async function getSignals() {
  const [prices, funding, fearGreed, trending] = await Promise.all([
    getPrices(),
    getFundingRates(),
    getFearGreed(),
    getTrending(),
  ]);

  return {
    prices,
    fundingRates: funding,
    fearGreed,
    trending,
    selectedToken: selectBestToken({ prices, funding, fearGreed, trending }),
    volatility: estimateVolatility(prices),
  };
}

export async function getPrices() {
  try {
    const { data } = await axios.get(`${CMC_API}/cryptocurrency/quotes/latest`, {
      headers: { 'X-CMC_PRO_API_KEY': config.cmc.apiKey },
      params: { symbol: 'BTC,ETH,BNB', convert: 'USD' },
    });
    return Object.entries(data.data).map(([sym, info]) => ({
      symbol: sym,
      price: info.quote.USD.price,
      volume24h: info.quote.USD.volume_24h,
      percentChange1h: info.quote.USD.percent_change_1h,
      percentChange24h: info.quote.USD.percent_change_24h,
      marketCap: info.quote.USD.market_cap,
    }));
  } catch (err) {
    console.warn('[CMC] Prices fetch failed:', err.message);
    return [];
  }
}

export async function getFundingRates() {
  try {
    const { data } = await axios.get(`${CMC_API}/derivatives/exchanges`, {
      headers: { 'X-CMC_PRO_API_KEY': config.cmc.apiKey },
      params: { limit: 5 },
    });
    return [];
  } catch {
    return [];
  }
}

export async function getFearGreed() {
  try {
    const { data } = await axios.get('https://api.alternative.me/fng/?limit=1');
    return {
      value: parseInt(data.data[0].value),
      classification: data.data[0].value_classification,
    };
  } catch {
    return { value: 50, classification: 'Neutral' };
  }
}

export async function getTrending() {
  try {
    const { data } = await axios.get(`${CMC_API}/cryptocurrency/trending/latest`, {
      headers: { 'X-CMC_PRO_API_KEY': config.cmc.apiKey },
      params: { limit: 10 },
    });
    return (data.data || []).map(t => ({
      symbol: t.symbol,
      name: t.name,
      price: t.quote?.USD?.price || 0,
      percentChange24h: t.quote?.USD?.percent_change_24h || 0,
    }));
  } catch {
    return [];
  }
}

function selectBestToken(marketData) {
  const { prices, trending } = marketData;
  if (!prices || prices.length === 0) return null;

  const candidates = [...prices];
  const btc = candidates.find(p => p.symbol === 'BTC');
  const eth = candidates.find(p => p.symbol === 'ETH');

  let best = eth || btc || candidates[0];

  if (trending.length > 0) {
    const topTrending = trending[0];
    const matched = candidates.find(p => p.symbol === topTrending.symbol);
    if (matched) best = matched;
  }

  return best;
}

function estimateVolatility(prices) {
  if (!prices || prices.length === 0) return 20;
  const changes = prices
    .filter(p => p.percentChange24h != null)
    .map(p => Math.abs(p.percentChange24h));
  if (changes.length === 0) return 20;
  return changes.reduce((a, b) => a + b, 0) / changes.length;
}

export async function getOHLC(symbol, interval = '4h', limit = 50) {
  return [];
}
