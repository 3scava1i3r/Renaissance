import { config } from '../src/config.js';
import * as cmc from '../src/data/cmc.js';
import * as bsc from '../src/data/bsc.js';
import * as quantScore from '../src/strategy/quant_score.js';
import * as perpsStrategy from '../src/strategy/perps_strategy.js';
import * as kelly from '../src/strategy/kelly.js';
import * as rugCheck from '../src/safety/rug_check.js';
import * as drawdown from '../src/safety/drawdown.js';
import * as pnl from '../src/monitoring/pnl.js';

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Renaissance — Test Cycle (Dry Run)');
  console.log('═══════════════════════════════════════════\n');

  pnl.load();

  // Phase 1: Data
  console.log('[1/5] Fetching data...');
  const cmcData = await cmc.getSignals();
  console.log(`  Prices: ${cmcData.prices.length} tokens`);
  console.log(`  Fear/Greed: ${cmcData.fearGreed?.classification} (${cmcData.fearGreed?.value})`);
  console.log(`  Volatility: ${cmcData.volatility?.toFixed(1)}%`);

  const portfolio = await bsc.getPortfolio();
  console.log(`  Portfolio: $${portfolio.totalUsd.toFixed(2)}`);

  // Phase 2: Scoring
  console.log('\n[2/5] Scoring...');
  const scores = await quantScore.scoreAll(cmcData, {});
  scores.slice(0, 5).forEach(s =>
    console.log(`  ${s.symbol}: ${s.score.toFixed(3)} ($${s.price})`)
  );

  // Phase 3: Strategy
  console.log('\n[3/5] Strategy...');
  const signal = perpsStrategy.evaluate(cmcData, { direction: 'LONG' });
  console.log(`  Signal: ${signal.direction || 'NONE'} ${signal.confidence ? `(${(signal.confidence * 100).toFixed(0)}%)` : ''}`);
  console.log(`  Reason: ${signal.reason}`);

  // Phase 4: Safety
  console.log('\n[4/5] Safety...');
  const rugResult = rugCheck.check(cmcData.selectedToken);
  console.log(`  Rug check: ${rugResult.level} (score: ${rugResult.score})`);

  const ddOk = drawdown.check();
  console.log(`  Drawdown: ${pnl.getSummary().drawdownPct.toFixed(1)}% (${ddOk ? 'OK' : 'HALTED'})`);

  // Phase 5: Position sizing
  console.log('\n[5/5] Position...');
  if (signal.direction && signal.confidence >= 0.6) {
    const decision = {
      action: signal.direction === 'LONG' ? 'BUY' : 'SELL',
      confidence: signal.confidence,
    };
    const sized = kelly.calculate(decision, portfolio.totalUsd, cmcData.volatility);
    console.log(`  Size: ${sized.sizePct}% = $${sized.sizeUsd.toFixed(2)}`);
    console.log(`  Kelly raw: ${sized.kellyRaw}`);
    console.log(`  Leverage: ${sized.leverage}x`);
  } else {
    console.log('  No trade signal — would HOLD');
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Test cycle complete');
  console.log('═══════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Test cycle failed:', err);
  process.exit(1);
});
