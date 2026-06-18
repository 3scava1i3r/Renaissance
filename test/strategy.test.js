import { describe, it } from 'node:test';
import assert from 'node:assert';

import * as quantScore from '../src/strategy/quant_score.js';
import * as perpsStrategy from '../src/strategy/perps_strategy.js';
import * as kelly from '../src/strategy/kelly.js';

describe('Strategy', () => {
  describe('quant_score', () => {
    it('should score tokens correctly', () => {
      const mockData = {
        prices: [
          { symbol: 'BTC', price: 60000, percentChange24h: 2, percentChange1h: 0.5, volume24h: 50000000000, marketCap: 1000000000000 },
          { symbol: 'ETH', price: 3000, percentChange24h: 3, percentChange1h: 1, volume24h: 20000000000, marketCap: 360000000000 },
          { symbol: 'BNB', price: 600, percentChange24h: -1, percentChange1h: -0.3, volume24h: 5000000000, marketCap: 90000000000 },
        ],
        selectedToken: { symbol: 'ETH', price: 3000 },
        volatility: 20,
      };

      const scores = quantScore.scoreAll(mockData, {});
      assert.ok(scores.length > 0);
      assert.ok(scores[0].score >= scores[1].score);
    });
  });

  describe('perps_strategy', () => {
    it('should generate a direction or null', () => {
      const mockData = {
        prices: [
          { symbol: 'BTC', price: 60000, percentChange24h: 5, percentChange1h: 1 },
          { symbol: 'ETH', price: 3000, percentChange24h: 3, percentChange1h: 0.5 },
        ],
      };

      const signal = perpsStrategy.evaluate(mockData, {});
      assert.ok(['LONG', 'SHORT', null].includes(signal.direction));
      if (signal.direction) {
        assert.ok(signal.confidence >= 0);
        assert.ok(typeof signal.reason === 'string');
      }
    });

    it('should return null with insufficient data', () => {
      const signal = perpsStrategy.evaluate({ prices: [] }, {});
      assert.strictEqual(signal.direction, null);
    });
  });

  describe('kelly', () => {
    it('should size position within limits', () => {
      const decision = { action: 'BUY', confidence: 0.8 };
      const result = kelly.calculate(decision, 10000, 20);
      assert.ok(result.sizePct >= 2);
      assert.ok(result.sizePct <= 20);
      assert.ok(result.sizeUsd > 0);
    });

    it('should return zero for HOLD', () => {
      const result = kelly.calculate({ action: 'HOLD' }, 10000, 20);
      assert.strictEqual(result.sizeUsd, 0);
    });
  });
});
