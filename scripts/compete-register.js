// Competition Registration for BNB Hack Track 1
// Registers agent on-chain via TWAK CLI or direct contract call
//
// Competition contract: 0x212c61b9b72c95d95bf29cf032f5e5635629aed5
// Network: BSC Mainnet (chain ID 56)
// Deadline: June 21, 2026 17:30 UTC
//
// Usage:
//   node scripts/compete-register.js          # via TWAK CLI
//   node scripts/compete-register.js --direct  # via direct contract call

import { execSync } from 'child_process';
import { config } from '../src/config.js';

const COMPETITION_CONTRACT = '0x212c61b9b72c95d95bf29cf032f5e5635629aed5';
const REQUIRED_NETWORK = 'bsc-mainnet';

async function main() {
  const method = process.argv.includes('--direct') ? 'direct' : 'twak';

  console.log('═══════════════════════════════════════════');
  console.log('  Track 1 — Competition Registration');
  console.log('═══════════════════════════════════════════\n');
  console.log(`Contract: ${COMPETITION_CONTRACT}`);
  console.log(`Network:  ${REQUIRED_NETWORK}`);
  console.log(`Agent:    ${config.wallet.address || 'not set'}`);
  console.log(`Method:   ${method}\n`);

  if (!config.wallet.privateKey) {
    console.error('❌ PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  if (method === 'twak') {
    await registerViaTWAK();
  } else {
    await registerDirect();
  }
}

async function registerViaTWAK() {
  try {
    console.log('Checking TWAK installation...');
    execSync('twak --version', { stdio: 'pipe' });
    console.log('✅ TWAK installed\n');

    console.log('Registering agent on competition contract...');
    console.log(`$ twak compete register --contract ${COMPETITION_CONTRACT}\n`);

    const output = execSync(
      `twak compete register --contract ${COMPETITION_CONTRACT} --json`,
      { encoding: 'utf-8', timeout: 60000 }
    );

    const result = JSON.parse(output);
    console.log('✅ Registration submitted!');
    console.log(`   Tx: ${result.transactionHash || result.txHash || 'check explorer'}`);
    console.log(`   Agent: ${result.agentAddress || result.wallet || config.wallet.address}`);

  } catch (err) {
    if (err.message.includes('command not found') || err.message.includes('not installed')) {
      console.error('❌ TWAK not installed. Install:');
      console.error('   curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash');
      console.error('\nThen get API credentials at: https://portal.trustwallet.com');
      process.exit(1);
    }

    console.error('❌ TWAK registration failed:', err.message);
    console.error('\nFalling back to direct registration...');
    await registerDirect();
  }
}

async function registerDirect() {
  console.log('Direct registration via contract call...\n');

  try {
    const { createWalletClient, http } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { bsc } = await import('viem/chains');

    const account = privateKeyToAccount(config.wallet.privateKey);
    const walletClient = createWalletClient({
      account,
      chain: bsc,
      transport: http(config.bsc.rpc || 'https://bsc-dataseed.binance.org'),
    });

    console.log(`Registering ${account.address} on competition contract...`);

    const txHash = await walletClient.writeContract({
      address: COMPETITION_CONTRACT,
      abi: [
        {
          inputs: [],
          name: 'register',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'register',
    });

    console.log('✅ Registration transaction submitted!');
    console.log(`   Tx: ${txHash}`);
    console.log(`   Explorer: https://bscscan.com/tx/${txHash}`);
    console.log('\n   Check status: https://bsctrace.com/address/${COMPETITION_CONTRACT}');

  } catch (err) {
    console.error('❌ Direct registration failed:', err.message);
    console.error('\nPossible issues:');
    console.error('   1. Wallet not funded with BNB for gas');
    console.error('   2. Wrong network (must be BSC mainnet)');
    console.error('   3. Competition registration may be closed');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Registration failed:', err);
  process.exit(1);
});
