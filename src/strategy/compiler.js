import { config } from '../config.js';

const DEFAULT_CONFIG = {
  asset: 'ETH',
  direction: 'LONG',
  entryConditions: null,
  exitConditions: {
    rsiOverbought: 70,
    rsiOversold: 30,
    trailingStop: 'ATR',
  },
  risk: {
    maxLeverage: config.rules.maxLeverage,
    maxPerTrade: 1000,
    maxDrawdown: config.rules.maxDrawdownPct,
  },
};

export async function compile() {
  const strategyNL = process.env.STRATEGY_NL;

  if (!strategyNL) {
    console.log('[Compiler] No STRATEGY_NL set, using default: long ETH perps');
    return {
      ...DEFAULT_CONFIG,
      _source: 'default',
    };
  }

  // Try AI compilation if API key available
  if (config.ai.anthropicKey) {
    try {
      return await compileWithAI(strategyNL);
    } catch (err) {
      console.warn('[Compiler] AI compilation failed, using default:', err.message);
    }
  }

  // Fallback: basic keyword parser
  return compileBasic(strategyNL);
}

function compileBasic(nl) {
  const lower = nl.toLowerCase();
  const config = { ...DEFAULT_CONFIG, _source: 'basic_parser' };

  if (lower.includes('short')) config.direction = 'SHORT';
  else config.direction = 'LONG';

  if (lower.includes('btc')) config.asset = 'BTC';
  else if (lower.includes('bnb')) config.asset = 'BNB';
  else config.asset = 'ETH';

  const levMatch = lower.match(/(\d+)x/);
  if (levMatch) config.risk.maxLeverage = parseInt(levMatch[1]);

  const maxMatch = lower.match(/\$(\d+)/);
  if (maxMatch) config.risk.maxPerTrade = parseInt(maxMatch[1]);

  const ddMatch = lower.match(/(\d+)\s*%\s*drawdown/);
  if (ddMatch) config.risk.maxDrawdown = parseInt(ddMatch[1]);

  if (lower.includes('funding') || lower.includes('funding rate')) {
    config.entryConditions = config.entryConditions || {};
    config.entryConditions.fundingRate = {
      comparison: lower.includes('negative') ? 'lt' : 'gt',
      value: 0,
    };
  }

  if (lower.includes('rsi')) {
    const rsiMatch = lower.match(/rsi\s*(<|>|below|above)\s*(\d+)/);
    if (rsiMatch) {
      config.entryConditions = config.entryConditions || {};
      config.entryConditions.rsi = {
        comparison: rsiMatch[1] === '<' || rsiMatch[1] === 'below' ? 'lt' : 'gt',
        value: parseInt(rsiMatch[2]),
      };
    }
  }

  return config;
}

async function compileWithAI(nl) {
  const { default: axios } = await import('axios');

  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: 'You are a strategy compiler. Convert natural language trading strategies into JSON config. Return ONLY valid JSON with keys: asset, direction (LONG/SHORT), entryConditions (optional object with fundingRate and/or rsi), exitConditions (rsiOverbought, rsiOversold, trailingStop), risk (maxLeverage, maxPerTrade, maxDrawdown).',
      messages: [{ role: 'user', content: nl }],
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
    return { ...DEFAULT_CONFIG, ...parsed, _source: 'ai' };
  }

  throw new Error('No JSON in LLM response');
}
