export function calculate(decision, portfolioUsd, volatility) {
  if (decision.action === 'HOLD' || !portfolioUsd || portfolioUsd <= 0) {
    return { sizeUsd: 0, sizePct: 0, leverage: 0 };
  }

  const winRate = decision.winRate || 0.55;
  const avgWin = decision.avgWin || 0.12;
  const avgLoss = decision.avgLoss || 0.05;
  const oddsRatio = avgWin / avgLoss;
  const kellyRaw = (winRate * oddsRatio - (1 - winRate)) / oddsRatio;

  const kellyFraction = decision.kellyFraction || 0.25;
  const sizedKelly = kellyRaw * kellyFraction;

  const conf = decision.confidence || 0.75;
  const confidenceMultiplier = Math.max(0, (conf - 0.65) / 0.35);

  const volFactor = Math.max(decision.volDampeningFloor || 0.2, 1 - ((volatility || 20) * 0.5 / 10));

  let sizePct = sizedKelly * confidenceMultiplier * volFactor * 100;
  sizePct = Math.max(2, Math.min(20, sizePct));

  const sizeUsd = portfolioUsd * (sizePct / 100);
  const leverage = decision.leverage || 5;

  return {
    sizeUsd: Math.round(sizeUsd * 100) / 100,
    sizePct: Math.round(sizePct * 100) / 100,
    kellyRaw: Math.round(kellyRaw * 1000) / 1000,
    leverage,
  };
}
