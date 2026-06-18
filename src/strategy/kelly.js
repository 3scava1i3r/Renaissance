export function calculate(decision, portfolioUsd, volatility) {
  if (decision.action === 'HOLD' || !portfolioUsd || portfolioUsd <= 0) {
    return { sizeUsd: 0, sizePct: 0, leverage: 0 };
  }

  const DEFAULT_WIN_RATE = 0.55;
  const DEFAULT_AVG_WIN = 0.12;
  const DEFAULT_AVG_LOSS = 0.05;

  // Full Kelly
  const winRate = decision.winRate || DEFAULT_WIN_RATE;
  const avgWin = decision.avgWin || DEFAULT_AVG_WIN;
  const avgLoss = decision.avgLoss || DEFAULT_AVG_LOSS;
  const oddsRatio = avgWin / avgLoss;
  const kellyRaw = (winRate * oddsRatio - (1 - winRate)) / oddsRatio;

  // Quarter-Kelly
  const quarterKelly = kellyRaw * 0.25;

  // Confidence scale: 0 at 65% confidence, 1 at 100%
  const conf = decision.confidence || 0.75;
  const confidenceMultiplier = Math.max(0, (conf - 0.65) / 0.35);

  // Volatility dampening
  const volFactor = Math.max(0.2, 1 - ((volatility || 20) * 0.5 / 10));

  let sizePct = quarterKelly * confidenceMultiplier * volFactor * 100;
  sizePct = Math.max(2, Math.min(20, sizePct));

  const sizeUsd = portfolioUsd * (sizePct / 100);

  return {
    sizeUsd: Math.round(sizeUsd * 100) / 100,
    sizePct: Math.round(sizePct * 100) / 100,
    kellyRaw: Math.round(kellyRaw * 1000) / 1000,
    leverage: 5,
  };
}
