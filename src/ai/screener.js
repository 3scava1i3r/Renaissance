import { config } from '../config.js';

export async function filter(signal, scores, cmcData) {
  // If we have a strong strategy signal, let it through
  if (signal && signal.direction && signal.confidence >= 0.6) {
    return { skip: false, interesting: [signal], reason: 'Strategy signal strong' };
  }

  // If no signal and no API key for LLM, skip
  if (!config.ai.anthropicKey && !config.ai.veniceKey) {
    return { skip: true, reason: 'No AI configured and no strategy signal' };
  }

  // If no scores, skip
  if (!scores || scores.length === 0) {
    return { skip: true, reason: 'No scores available' };
  }

  // Use top score as basic filter
  const topScore = scores[0];
  if (topScore && topScore.score > 0.3) {
    return {
      skip: false,
      interesting: [topScore],
      reason: `Top score: ${topScore.symbol} at ${topScore.score.toFixed(2)}`,
    };
  }

  // Try LLM screening
  if (config.ai.anthropicKey || config.ai.veniceKey) {
    return await screenWithLLM(signal, scores, cmcData);
  }

  return { skip: true, reason: 'No high-confidence signals' };
}

async function screenWithLLM(signal, scores, cmcData) {
  const marketContext = {
    btcPrice: cmcData.prices?.find(p => p.symbol === 'BTC')?.price || 0,
    ethPrice: cmcData.prices?.find(p => p.symbol === 'ETH')?.price || 0,
    fearGreed: cmcData.fearGreed?.classification || 'Neutral',
    topTokens: scores.slice(0, 3).map(s => `${s.symbol}(${s.score.toFixed(2)})`).join(', '),
  };

  const prompt = `Market: BTC $${marketContext.btcPrice}, ETH $${marketContext.ethPrice}, Fear/Greed: ${marketContext.fearGreed}
Top tokens: ${marketContext.topTokens}
Signal: ${signal ? signal.direction + ' ' + signal.reason : 'none'}
Should we trade? Reply with JSON: {"skip": bool, "reason": "..."}`;

  try {
    // Use Anthropic Haiku for cheap screening
    if (config.ai.anthropicKey) {
      const { default: axios } = await import('axios');
      const { data } = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-haiku-3-5-20241022',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'x-api-key': config.ai.anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
        }
      );
      const text = data.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          skip: parsed.skip !== false,
          interesting: parsed.skip ? [] : [signal || scores[0]],
          reason: parsed.reason || 'LLM decision',
        };
      }
    }
  } catch (err) {
    console.warn('[Screener] LLM failed:', err.message);
  }

  return { skip: true, reason: 'LLM screening unavailable' };
}
