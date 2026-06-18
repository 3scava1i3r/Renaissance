import { describe, it } from 'node:test';
import assert from 'node:assert';

import * as rugCheck from '../src/safety/rug_check.js';
import * as drawdown from '../src/safety/drawdown.js';
import * as pnl from '../src/monitoring/pnl.js';

describe('Safety', () => {
  describe('rug_check', () => {
    it('should pass safe tokens', () => {
      const token = {
        symbol: 'ETH',
        volume24h: 20000000000,
        marketCap: 360000000000,
        percentChange24h: 3,
      };
      const result = rugCheck.check(token);
      assert.ok(result.pass);
      assert.ok(result.score >= 60);
    });

    it('should flag suspicious tokens', () => {
      const token = {
        symbol: 'SHIT',
        volume24h: 100,
        marketCap: 50000,
        percentChange24h: 5000,
      };
      const result = rugCheck.check(token);
      assert.ok(!result.pass || result.level !== 'SAFE');
    });

    it('should pass null token', () => {
      const result = rugCheck.check(null);
      assert.ok(result.pass);
    });
  });

  describe('drawdown', () => {
    it('should check drawdown without halting', () => {
      drawdown.reset();
      const result = drawdown.check();
      assert.strictEqual(result, true);
    });
  });

  describe('pnl', () => {
    it('should track summary correctly', () => {
      pnl.load();
      const summary = pnl.getSummary();
      assert.ok(typeof summary.currentValue === 'number');
      assert.ok(typeof summary.drawdownPct === 'number');
      assert.ok(typeof summary.totalPnl === 'number');
    });

    it('should track costs', () => {
      pnl.load();
      const before = pnl.getSummary().tradeCount;
      pnl.recordTrade({ symbol: 'ETH', size: 100 });
      const summary = pnl.getSummary();
      assert.ok(summary.totalCosts > 0);
      assert.strictEqual(summary.tradeCount, before + 1);
    });
  });
});
