import { config } from '../src/config.js';
import * as cmc from '../src/data/cmc.js';
import * as bsc from '../src/data/bsc.js';
import * as quantScore from '../src/strategy/quant_score.js';
import * as perpsStrategy from '../src/strategy/perps_strategy.js';
import * as kelly from '../src/strategy/kelly.js';
import * as rugCheck from '../src/safety/rug_check.js';
import * as drawdown from '../src/safety/drawdown.js';
import * as pnl from '../src/monitoring/pnl.js';
import { isEligible, getEligibleTokens } from '../src/data/tokens.js';

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Renaissance — Test Cycle (Dry Run)');
  console.log('═══════════════════════════════════════════\n');

  console.log('[X/5] Token allowlist...');
  const eligibleTokens = getEligibleTokens();
  console.log(`  ${eligibleTokens.length} eligible BEP-20 tokens loaded`);
  const testTokens = ['ETH', 'USDT', 'CAKE', 'INVALID_TOKEN'];
  testTokens.forEach(t => {
    console.log(`  ${t}: ${isEligible(t) ? '✅ eligible' : '❌ not in list'}`);
  });

  pnl.load();

  // Phase 1: Data
  console.log('\n[1/5] Fetching data...');
  let cmcData;
  try {
    cmcData = await cmc.getSignals();
    console.log(`  Prices: ${cmcData.prices?.length || 0} tokens`);
    console.log(`  Fear/Greed: ${cmcData.fearGreed?.classification || 'N/A'} (${cmcData.fearGreed?.value || 'N/A'})`);
    console.log(`  Volatility: ${cmcData.volatility?.toFixed(1) || 'N/A'}%`);
  } catch (err) {
    console.log(`  ⚠️ CMC data unavailable (${err.message}) — using defaults`);
    cmcData = { prices: [], fearGreed: {}, volatility: 20, selectedToken: 'ETH' };
  }

  let portfolio;
  try {
    portfolio = await bsc.getPortfolio();
    console.log(`  Portfolio: $${portfolio.totalUsd.toFixed(2)}`);
  } catch (err) {
    console.log(`  ⚠️ Portfolio unavailable (${err.message}) — using default $10,000`);
    portfolio = { totalUsd: 10000, bnb: 0, usdc: 0 };
  }

  // Phase 2: Scoring
  console.log('\n[2/5] Scoring...');
  try {
    const scores = await quantScore.scoreAll(cmcData, {});
    scores.slice(0, 5).forEach(s =>
      console.log(`  ${s.symbol}: ${s.score.toFixed(3)} ($${s.price})`)
    );
  } catch (err) {
    console.log(`  ⚠️ Scoring unavailable (${err.message})`);
  }

  // Phase 3: Strategy
  console.log('\n[3/5] Strategy...');
  let signal;
  try {
    signal = perpsStrategy.evaluate(cmcData, { direction: 'LONG' });
    console.log(`  Signal: ${signal.direction || 'NONE'} ${signal.confidence ? `(${(signal.confidence * 100).toFixed(0)}%)` : ''}`);
    console.log(`  Reason: ${signal.reason || 'N/A'}`);
  } catch (err) {
    console.log(`  ⚠️ Strategy unavailable (${err.message})`);
    signal = { direction: 'HOLD', confidence: 0, asset: 'ETH' };
  }

  // Phase 4: Safety
  console.log('\n[4/5] Safety...');
  try {
    const rugResult = rugCheck.check(cmcData.selectedToken);
    console.log(`  Rug check: ${rugResult.level} (score: ${rugResult.score})`);
  } catch (err) {
    console.log(`  ⚠️ Rug check unavailable (${err.message})`);
  }

  const ddOk = drawdown.check();
  console.log(`  Drawdown: ${pnl.getSummary().drawdownPct.toFixed(1)}% (${ddOk ? 'OK' : 'HALTED'})`);

  // Phase 5: Position sizing
  console.log('\n[5/5] Position...');
  if (signal.direction && signal.confidence >= 0.6) {
    const targetAsset = signal.asset || 'ETH';
    const eligible = isEligible(targetAsset);
    console.log(`  Token: ${targetAsset} (${eligible ? '✅ eligible' : '❌ not eligible'})`);

    const decision = {
      action: signal.direction === 'LONG' ? 'BUY' : 'SELL',
      confidence: signal.confidence,
    };
    try {
      const sized = kelly.calculate(decision, portfolio.totalUsd, cmcData.volatility);
      console.log(`  Size: ${sized.sizePct}% = $${sized.sizeUsd.toFixed(2)}`);
      console.log(`  Kelly raw: ${sized.kellyRaw}`);
      console.log(`  Leverage: ${sized.leverage}x`);
    } catch (err) {
      console.log(`  ⚠️ Kelly sizing unavailable (${err.message})`);
    }
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
