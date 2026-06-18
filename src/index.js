import { config } from './config.js';
import { runCycle } from './loop.js';
import * as pnl from './monitoring/pnl.js';

console.log('═══════════════════════════════════════════');
console.log('  Renaissance — BNB AI Trading Agent');
console.log(`  Agent: ${config.wallet.address || 'not set'}`);
console.log(`  Chain: BSC ${config.bsc.chainId}`);
console.log(`  Cycle: every ${config.rules.cycleIntervalMs / 60000}min`);
console.log(`  Max Drawdown: ${config.rules.maxDrawdownPct}%`);
console.log('═══════════════════════════════════════════\n');

async function main() {
  pnl.load();

  await runCycle();
  setInterval(runCycle, config.rules.cycleIntervalMs);

  process.on('SIGINT', () => {
    console.log('\n[Shutdown] Saving state...');
    pnl.save();
    process.exit(0);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Fatal]', err.message);
    pnl.save();
    process.exit(1);
  });
}

main();
