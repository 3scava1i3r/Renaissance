export function evaluate(cmcData, strategy) {
  const { prices, fundingRates } = cmcData;

  if (!prices || prices.length < 2) {
    return { direction: null, confidence: 0, reason: 'Insufficient data' };
  }

  const targetSymbol = (strategy && strategy.asset) || 'ETH';
  const target = prices.find(p => p.symbol === targetSymbol);
  if (!target) {
    return { direction: null, confidence: 0, reason: `${targetSymbol} not found in prices` };
  }

  const price = target.price;
  const change1h = target.percentChange1h || 0;
  const change24h = target.percentChange24h || 0;

  const ema20 = price * (1 + change1h / 100 * 20);
  const ema50 = price * (1 + change24h / 100 * 50);
  const trendUp = ema20 > ema50;

  const rsi = 50 + (change24h * 2);
  const rsiClamped = Math.max(0, Math.min(100, rsi));

  const rsiOverbought = (strategy && strategy.exitConditions && strategy.exitConditions.rsiOverbought) || 70;
  const rsiOversold = (strategy && strategy.exitConditions && strategy.exitConditions.rsiOversold) || 30;

  const targetFunding = (fundingRates || []).find(f => f.symbol === targetSymbol);
  const fundingRate = targetFunding ? targetFunding.fundingRate : 0;

  let direction = null;
  let confidence = 0;

  if (trendUp && price > ema20 && rsiClamped < rsiOverbought) {
    direction = 'LONG';
    confidence = 0.75 - (rsiClamped > (rsiOverbought - 10) ? 0.1 : 0);
    if (fundingRate < 0) confidence = Math.min(0.85, confidence + 0.05);
  } else if (!trendUp && price < ema20 && rsiClamped > rsiOversold) {
    direction = 'SHORT';
    confidence = 0.70 - (rsiClamped < (rsiOversold + 10) ? 0.1 : 0);
    if (fundingRate > 0) confidence = Math.min(0.80, confidence + 0.05);
  }

  if (strategy && strategy.entryConditions) {
    const override = applyStrategyConditions(strategy, rsiClamped, fundingRate);
    if (override) {
      direction = override.direction;
      confidence = override.confidence;
    }
  }

  const minConfidence = (strategy && strategy.risk && strategy.risk.minConfidence) || 0.6;
  if (!direction || confidence < minConfidence) {
    return { direction: null, confidence: 0, reason: 'No clear signal' };
  }

  return {
    direction,
    confidence: Math.round(confidence * 100) / 100,
    reason: `${direction} signal — RSI ${rsiClamped.toFixed(1)}, ${trendUp ? 'uptrend' : 'downtrend'}, funding ${(fundingRate * 100).toFixed(4)}%`,
  };
}

function applyStrategyConditions(strategy, rsi, fundingRate) {
  const cond = strategy.entryConditions;
  if (!cond) return null;

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
