import dotenv from 'dotenv';
dotenv.config();

export const config = {
  bsc: {
    rpc: process.env.BSC_RPC || 'https://bsc-testnet-rpc.publicnode.com',
    chainId: parseInt(process.env.BSC_CHAIN_ID || '97'),
  },
  cmc: {
    apiKey: process.env.CMC_API_KEY || '',
    mcpEnabled: process.env.CMC_MCP_ENABLED === 'true',
  },
  twak: {
    accessId: process.env.TWAK_ACCESS_ID || '',
    hmacSecret: process.env.TWAK_HMAC_SECRET || '',
  },
  wallet: {
    privateKey: process.env.PRIVATE_KEY || '',
    address: process.env.AGENT_WALLET || '',
  },
  vault: {
    address: process.env.VAULT_ADDRESS || '',
  },
  ai: {
    veniceKey: process.env.VENICE_API_KEY || '',
    anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  rules: {
    maxDrawdownPct: parseFloat(process.env.MAX_DRAWDOWN_PCT || '30'),
    minTradesPerDay: parseInt(process.env.MIN_TRADES_PER_DAY || '1'),
    maxLeverage: parseInt(process.env.MAX_LEVERAGE || '5'),
    maxPositionPct: parseFloat(process.env.MAX_POSITION_PCT || '20'),
    cycleIntervalMs: parseInt(process.env.CYCLE_INTERVAL_MS || '1800000'),
  },
};

export const STATE = {
  SCANNING: 'SCANNING',
  IN_POSITION: 'IN_POSITION',
  EXITING: 'EXITING',
  HALTED: 'HALTED',
};
