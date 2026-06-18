import { config } from '../src/config.js';

const VAULT_ABI = [
  'function deposit(uint256 amount) external',
  'function spend(address to, uint256 amount, string calldata reason) external',
  'function getAvailableYield() external view returns (uint256)',
  'function getStatus() external view returns (uint256,uint256,uint256,uint256,uint256,uint256)',
  'function updateGuardrails(uint256 _maxPerTransaction, uint256 _maxDailySpend) external',
];

async function main() {
  console.log('========================================');
  console.log('  Deploy TreasuryVault to BSC Testnet');
  console.log('========================================\n');

  console.log('To deploy, run:');
  console.log('');
  console.log('npx hardhat run scripts/deploy-vault.js --network bscTestnet');
  console.log('');
  console.log('Constructor params:');
  console.log(`  depositToken:     USDC (${getUSDCDecimals()} decimals)`);
  console.log(`  yieldToken:       same as depositToken`);
  console.log(`  agent:            ${config.wallet.address || '0x...'}`);
  console.log(`  maxPerTransaction: $100 (100000000)`);
  console.log(`  maxDailySpend:    $500 (500000000)\n`);
  console.log('Make sure you have:');
  console.log('  1. Hardhat installed');
  console.log('  2. @openzeppelin/contracts installed');
  console.log('  3. BSC testnet BNB in wallet (faucet: https://www.bnbchain.org/en/testnet-faucet)');
  console.log('  4. Edit hardhat.config.cjs with network config\n');
}

function getUSDCDecimals() {
  return 6; // USDC on BSC has 6 decimals
}

main().catch(console.error);
