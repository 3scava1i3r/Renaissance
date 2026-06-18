import { config } from '../config.js';

export async function makeDecision(scores, signal, portfolio, cmcData, compiledStrategy) {
  const topScore = scores && scores.length > 0 ? scores[0] : null;
  const hasSignal = signal && signal.direction && signal.confidence >= 0.6;
  const hasConfidence = compiledStrategy && compiledStrategy._source;

  // If Venice AI available, use it for final decision
  if (config.ai.veniceKey) {
    return await decideWithVenice(scores, signal, portfolio, cmcData, compiledStrategy);
  }

  // Fallback decision logic
  if (!hasSignal && (!topScore || topScore.score < 0.3)) {
    return { action: 'HOLD', reason: 'No strong signals', confidence: 0 };
  }

  if (hasSignal && topScore && topScore.score > 0) {
    const asset = compiledStrategy?.asset || 'ETH';
    const direction = signal.direction;
    const confidence = signal.confidence;

    console.log(`[Decision] ${direction} ${asset} @ ${confidence * 100}% confidence`);

    return {
      action: direction === 'LONG' ? 'BUY' : 'SELL',
      asset,
      direction,
      sizePct: Math.min(config.rules.maxPositionPct, 15),
      confidence,
      leverage: compiledStrategy?.risk?.maxLeverage || config.rules.maxLeverage,
      reason: signal.reason,
    };
  }

  return { action: 'HOLD', reason: 'No actionable opportunity', confidence: 0 };
}

async function decideWithVenice(scores, signal, portfolio, cmcData, strategy) {
  const { default: axios } = await import('axios');

  const topScores = scores.slice(0, 5).map(s =>
    `${s.symbol}: score=${s.score.toFixed(2)}, price=$${s.price}, 24h=${s.change24h}%`
  ).join('\n');

  const prompt = {
    model: 'llama-3.3-70b',
    messages: [
      {
        role: 'system',
        content: `You are an autonomous trading agent for BNB Chain perps.
Portfolio: $${portfolio.totalUsd.toFixed(2)}
Max drawdown: ${config.rules.maxDrawdownPct}%
Strategy: ${strategy?.direction || 'BALANCED'} ${strategy?.asset || 'ETH'} ${strategy?.risk?.maxLeverage || 5}x

Return ONLY valid JSON:
{"action": "BUY"|"SELL"|"HOLD", "asset": "ETH", "direction": "LONG"|"SHORT", "sizePct": 2-20, "confidence": 0-1, "leverage": 1-5, "reason": "..."}`,
      },
      {
        role: 'user',
        content: `Market: BTC $${cmcData.prices?.find(p => p.symbol === 'BTC')?.price || 'N/A'}, ETH $${cmcData.prices?.find(p => p.symbol === 'ETH')?.price || 'N/A'}
Fear/Greed: ${cmcData.fearGreed?.classification || 'N/A'} (${cmcData.fearGreed?.value || 'N/A'})
Volatility: ${cmcData.volatility?.toFixed(1)}%
Signal: ${signal ? `${signal.direction} (${(signal.confidence * 100).toFixed(0)}%) - ${signal.reason}` : 'none'}
Scores:\n${topScores}

What action?`,
      },
    ],
    temperature: 0.2,
  };

  try {
    const { data } = await axios.post(
      'https://api.venice.ai/api/v1/chat/completions',
      prompt,
      {
        headers: {
          'Authorization': `Bearer ${config.ai.veniceKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const text = data.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || 'HOLD',
        asset: parsed.asset || strategy?.asset || 'ETH',
        direction: parsed.direction || strategy?.direction || 'LONG',
        sizePct: parsed.sizePct || 10,
        confidence: parsed.confidence || 0.5,
        leverage: parsed.leverage || config.rules.maxLeverage,
        reason: parsed.reason || 'Venice AI decision',
        _source: 'venice',
      };
    }
  } catch (err) {
    console.warn('[Venice] API failed:', err.message);
  }

  return { action: 'HOLD', reason: 'Venice AI unavailable', confidence: 0 };
}
