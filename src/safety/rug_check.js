export function check(token) {
  if (!token) {
    return { pass: true, score: 100, reason: 'No token to check' };
  }

  let score = 100;

  // 1. Liquidity gate
  if (token.volume24h != null) {
    if (token.volume24h < 50000) score -= 40;
    else if (token.volume24h < 200000) score -= 20;
  } else {
    score -= 30;
  }

  // 2. Price age (based on market cap as proxy for maturity)
  if (token.marketCap != null) {
    if (token.marketCap < 1000000) score -= 25;
    else if (token.marketCap < 10000000) score -= 10;
  }

  // 3. Volume momentum
  if (token.percentChange24h != null) {
    if (token.percentChange24h > 1000) score -= 20; // suspicious pump
    if (token.percentChange24h < -90) score -= 30; // near zero
  }

  // 4. Exchange presence
  if (token.volume24h != null && token.volume24h === 0) {
    score -= 25;
  }

  const pass = score >= 60;
  const level = score >= 80 ? 'SAFE' : score >= 60 ? 'CAUTION' : score >= 40 ? 'RISKY' : 'LIKELY_RUG';

  return {
    pass,
    score,
    level,
    reason: level === 'SAFE' ? 'Token passed safety checks'
      : level === 'CAUTION' ? 'Low liquidity or volume'
      : level === 'RISKY' ? 'Suspicious token pattern'
      : 'Token exhibits rug-like characteristics',
  };
}
