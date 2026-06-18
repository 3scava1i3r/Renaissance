import { config, STATE } from './config.js';
import * as cmc from './data/cmc.js';
import * as bsc from './data/bsc.js';
import * as quantScore from './strategy/quant_score.js';
import * as perpsStrategy from './strategy/perps_strategy.js';
import * as kelly from './strategy/kelly.js';
import * as compiler from './strategy/compiler.js';
import * as rugCheck from './safety/rug_check.js';
import * as drawdown from './safety/drawdown.js';
import * as stops from './safety/stops.js';
import * as twak from './execution/twak.js';
import * as perps from './execution/perps.js';
import * as screener from './ai/screener.js';
import { makeDecision } from './ai/decision.js';
import * as journal from './monitoring/journal.js';
import * as pnl from './monitoring/pnl.js';
import * as telegram from './monitoring/telegram.js';
import { isEligible } from './data/tokens.js';

let cycleCount = 0;
let state = STATE.SCANNING;
let compiledStrategy = null;

export function getState() {
  return { cycleCount, state, compiledStrategy };
}

export async function runCycle() {
  cycleCount++;
  const cycleStart = Date.now();
  console.log(`\n[Cycle #${cycleCount}] ${new Date().toISOString()} — ${state}`);

  if (state === STATE.HALTED) {
    console.log('[HALTED] Drawdown limit exceeded. Monitoring only.');
    await sleep(config.rules.cycleIntervalMs);
    return;
  }

  try {
    // Phase 1: Compile strategy from NL if not set
    if (!compiledStrategy) {
      compiledStrategy = await compiler.compile();
      console.log('[Strategy] Compiled:', JSON.stringify(compiledStrategy, null, 2));
    }

    // Phase 2: Sense — collect data
    state = STATE.SCANNING;
    const cmcData = await cmc.getSignals();
    const portfolio = await bsc.getPortfolio();
    const positions = await stops.getOpenPositions();

    // Phase 3: Think — score + strategy
    const scores = await quantScore.scoreAll(cmcData, compiledStrategy);
    const signal = perpsStrategy.evaluate(cmcData, compiledStrategy);
    const rugSafe = rugCheck.check(cmcData.selectedToken);
    const screenResult = await screener.filter(signal, scores, cmcData);

    if (screenResult.skip) {
      console.log(`[Screener] Skip: ${screenResult.reason}`);
      await finalize({ action: 'HOLD' });
      return;
    }

    // Phase 4: Check token allowlist eligibility
    const targetAsset = signal?.asset || compiledStrategy?.asset || 'ETH';
    if (!isEligible(targetAsset)) {
      console.log(`[Allowlist] ${targetAsset} not eligible — skipping`);
      await finalize({ action: 'HOLD', reason: `token ${targetAsset} not in competition allowlist` });
      return;
    }

    // Phase 5: Act — decide + execute
    state = STATE.IN_POSITION;
    const decision = await makeDecision(scores, signal, portfolio, cmcData, compiledStrategy);

    if (decision.action === 'HOLD') {
      console.log('[Decision] HOLD — no trade this cycle');
      await finalize(decision);
      return;
    }

    // Phase 6: Check — safety gate
    if (!drawdown.check()) {
      state = STATE.HALTED;
      console.error('[Safety] DRAWDOWN LIMIT EXCEEDED — agent halted');
      await telegram.sendAlert('🚨 AGENT HALTED — drawdown exceeded 30%');
      await finalize(decision);
      return;
    }

    if (!rugSafe.pass) {
      console.log(`[Safety] Rug block: ${rugSafe.reason}`);
      await finalize({ action: 'HOLD', reason: 'rug_block' });
      return;
    }

    // Check existing stop levels
    await stops.checkStops(positions);

    // Phase 7: Execute
    const sized = kelly.calculate(decision, portfolio.totalUsd, cmcData.volatility);
    const result = await perps.execute(sized, compiledStrategy);
    journal.recordEntry(result);
    pnl.recordTrade(result);
    await telegram.sendTradeAlert(result);

    // Phase 8: Log + sleep
    await finalize(result);
  } catch (err) {
    console.error(`[Cycle #${cycleCount}] Error:`, err.message);
    await telegram.sendAlert(`⚠️ Cycle error: ${err.message}`);
    await finalize({ action: 'HOLD', error: err.message });
  }
}

async function finalize(result) {
  journal.cycleSummary({ cycleCount, state, result });
  pnl.updatePortfolio();
  const trail = stops.updateTrailingStops();

  if (trail && trail.triggered) {
    await telegram.sendAlert(`🔴 Stop triggered: ${trail.asset} at ${trail.price}`);
  }

  // Enforce min trades per day
  drawdown.checkMinTrades();

  const elapsed = Date.now() - cycleStart;
  console.log(`[Cycle #${cycleCount}] Done in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`[Portfolio] $${pnl.getSummary().currentValue.toFixed(2)} | Drawdown: ${pnl.getSummary().drawdownPct.toFixed(1)}%`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
