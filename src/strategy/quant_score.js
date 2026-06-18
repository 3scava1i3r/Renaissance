export function scoreAll(cmcData, strategy) {
  const { prices, selectedToken, volatility } = cmcData;
  if (!prices || prices.length === 0) return [];

  const scores = prices.map(token => {
    const score = scoreToken(token, prices);
    return {
      symbol: token.symbol,
      score,
      price: token.price,
      change24h: token.percentChange24h,
    };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

function scoreToken(token, allPrices) {
  if (!token.percentChange24h && token.percentChange24h !== 0) return 0;

  const btc = allPrices.find(p => p.symbol === 'BTC');
  const btcRet24h = btc?.percentChange24h || 0;

  // Trend filter
  const trendFilter = token.percentChange24h > 0 ? 1 : 0.5;

  // Relative strength vs BTC
  const relStr = token.percentChange24h - btcRet24h;

  // Volume signal
  const volSignal = Math.tanh(token.volume24h > 100000000 ? 0.5 : -0.5);

  // Momentum
  const momentum = token.percentChange1h || 0;

  // Score blend
  const raw = (
    Math.tanh(relStr * 0.1) * 0.33 +
    volSignal * 0.25 +
    Math.tanh(momentum * 0.5) * 0.22 +
    Math.tanh(token.percentChange24h * 0.05) * 0.20
  ) * trendFilter;

  return clamp(raw, -1, 1);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
