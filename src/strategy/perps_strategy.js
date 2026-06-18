export function evaluate(cmcData, strategy) {
  const { prices, fundingRates } = cmcData;

  if (!prices || prices.length < 2) {
    return { direction: null, confidence: 0, reason: 'Insufficient data' };
  }

  const eth = prices.find(p => p.symbol === 'ETH');
  if (!eth) {
    return { direction: null, confidence: 0, reason: 'ETH not found' };
  }

  const price = eth.price;
  const change1h = eth.percentChange1h || 0;
  const change24h = eth.percentChange24h || 0;

  // Simulated EMA20/50 using 1h + 24h changes
  const ema20 = price * (1 + change1h / 100 * 20);
  const ema50 = price * (1 + change24h / 100 * 50);
  const trendUp = ema20 > ema50;

  // RSI-like signal from 24h change
  const rsi = 50 + (change24h * 2);
  const rsiClamped = Math.max(0, Math.min(100, rsi));

  // Direction logic
  let direction = null;
  let confidence = 0;

  if (trendUp && price > ema20 && rsiClamped < 70) {
    direction = 'LONG';
    confidence = 0.75 - (rsiClamped > 60 ? 0.1 : 0);
  } else if (!trendUp && price < ema20 && rsiClamped > 30) {
    direction = 'SHORT';
    confidence = 0.70 - (rsiClamped < 40 ? 0.1 : 0);
  }

  // Override from compiled strategy if it specifies conditions
  if (strategy && strategy.entryConditions) {
    const override = applyStrategyConditions(strategy, eth, rsiClamped);
    if (override) {
      direction = override.direction;
      confidence = override.confidence;
    }
  }

  if (!direction || confidence < 0.6) {
    return { direction: null, confidence: 0, reason: 'No clear signal' };
  }

  return {
    direction,
    confidence: Math.round(confidence * 100) / 100,
    reason: `${direction} signal — RSI ${rsiClamped.toFixed(1)}, ${trendUp ? 'uptrend' : 'downtrend'}`,
  };
}

function applyStrategyConditions(strategy, eth, rsi) {
  const cond = strategy.entryConditions;
  if (!cond) return null;

  const fundingRate = 0; // Would come from CMC perp data

  let matches = true;

  if (cond.fundingRate) {
    const dir = cond.fundingRate.comparison;
    const val = cond.fundingRate.value;
    if (dir === 'lt' && fundingRate >= val) matches = false;
    if (dir === 'gt' && fundingRate <= val) matches = false;
  }

  if (cond.rsi) {
    const dir = cond.rsi.comparison;
    const val = cond.rsi.value;
    if (dir === 'lt' && rsi >= val) matches = false;
    if (dir === 'gt' && rsi <= val) matches = false;
  }

  if (!matches) return null;

  return {
    direction: strategy.direction || 'LONG',
    confidence: 0.80,
  };
}
