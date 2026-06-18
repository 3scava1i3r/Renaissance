# Renaissance

An autonomous AI trading agent for BNB Chain. Natural-language strategy in, on-chain execution out.

## Track

**BNB Hack: AI Trading Agent Edition — Track 1: Autonomous Trading Agents**

- $24,000 prize pool (5 winners)
- Scored on real PnL with 30% max drawdown cap
- Minimum 1 trade/day during competition week
- Simulated transaction costs apply
- Stack: CMC AI Agent Hub, Trust Wallet Agent Kit, BNB AI Agent SDK, BSC

## Architecture

```
User NL Strategy
       │
       ▼
┌──────────────────────┐
│  strategy/compiler.js │ ← LLM compiles "long ETH when..." into JSON
└──────────┬───────────┘
           │ JSON config
           ▼
┌──────────────────────┐
│   30-min Heartbeat   │
│     (loop.js)        │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  CMC Agent Hub (MCP) │ ← Prices, funding, social, signals
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Multi-Layer AI      │
│                      │
│  Layer 1: Scoring    │ ← Quant scoring: trend, momentum, volume
│  Layer 2: Strategy   │ ← EMA/RSI/funding rate perps strategy
│  Layer 3: Venice AI  │ ← Private TEE reasoning (final decision)
│  Layer 4: Kelly      │ ← Quarter-Kelly + volatility dampening
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Safety Gate (CHECK) │
│                      │
│  ✓ Rug detection     │
│  ✓ 30% max drawdown  │
│  ✓ Min trade/day     │
│  ✓ Txn cost tracking │
│  ✓ ATR trailing stops│
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  TWAK + PancakeSwap  │
│                      │
│  Self-custody signing│
│  BSC perps execution │
│  TreasuryVault lock  │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Monitoring          │
│                      │
│  Trade journal       │
│  PnL tracker         │
│  Telegram alerts     │
└──────────────────────┘
```

## File Structure

```
Renaissance/
├── package.json
├── .env.example
├── plan.md
├── README.md
├── src/
│   ├── index.js                # Entry point — starts the daemon
│   ├── config.js               # Environment + constants
│   ├── loop.js                 # 30-min heartbeat cycle
│   ├── data/
│   │   ├── cmc.js              # CMC Agent Hub (MCP + HTTP)
│   │   └── bsc.js              # BSC RPC via viem
│   ├── strategy/
│   │   ├── compiler.js         # NL → JSON strategy config (1 LLM call)
│   │   ├── quant_score.js      # Trend/momentum/volume signal blend
│   │   ├── perps_strategy.js   # EMA20/50, RSI(14), funding rate
│   │   └── kelly.js            # Quarter-Kelly + volatility dampening
│   ├── safety/
│   │   ├── rug_check.js        # 8-check token safety screen
│   │   ├── drawdown.js         # 30% max drawdown + trade counter
│   │   └── stops.js            # ATR trailing stops (3-layer)
│   ├── execution/
│   │   ├── twak.js             # TWAK CLI wrapper
│   │   └── perps.js            # PancakeSwap perps via TWAK
│   ├── ai/
│   │   ├── screener.js         # Cheap LLM pre-filter
│   │   └── decision.js         # Combine signals → Venice → action
│   └── monitoring/
│       ├── journal.js          # Trade journal + positions
│       ├── pnl.js              # PnL + drawdown tracker
│       └── telegram.js         # Telegram alerts
├── contracts/
│   └── TreasuryVault.sol       # Principal-locked yield vault
├── scripts/
│   ├── deploy-vault.js         # Deploy vault to BSC
│   ├── register-agent.js       # ERC-8004 identity
│   └── test-cycle.js           # Dry run
├── test/
│   ├── strategy.test.js
│   └── safety.test.js
└── data/
    ├── positions.json
    └── trade_journal.jsonl
```

## Build Plan (4 Days)

### Day 1 — Foundation + Data

#### `package.json`
```json
{
  "name": "renaissance",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test test/*.test.js",
    "dry": "node scripts/test-cycle.js"
  },
  "dependencies": {
    "dotenv": "^16.0.0",
    "viem": "^2.47.0",
    "ethers": "^6.0.0",
    "axios": "^1.13.0",
    "express": "^4.18.0",
    "node-telegram-bot-api": "^0.64.0",
    "zod": "^3.22.0"
  }
}
```

#### `src/config.js`
Reads env vars, exports typed config:
- `BSC_RPC`, `BSC_CHAIN_ID`
- `CMC_API_KEY`, `CMC_MCP_ENABLED`
- `TWAK_ACCESS_ID`, `TWAK_HMAC_SECRET`
- `PRIVATE_KEY`, `AGENT_WALLET`
- `VAULT_ADDRESS`
- Rules: `MAX_DRAWDOWN_PCT: 30`, `MIN_TRADES_PER_DAY: 1`, `MAX_LEVERAGE: 5`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `VENICE_API_KEY`, `ANTHROPIC_API_KEY`
- Cycle interval: `CYCLE_MS: 30 * 60 * 1000`

#### `src/loop.js`
30-min heartbeat cycle

#### `src/data/cmc.js`
CMC Agent Hub calls

#### `src/data/bsc.js`
BSC RPC via viem

#### `contracts/TreasuryVault.sol`
Principal-locked yield vault with guardrails

---

### Day 2 — Strategy + Safety

#### `src/strategy/quant_score.js`
Signal blend: trend filter, relative strength, volume direction, momentum acceleration, range compression, oversold bounce, volatility regime

#### `src/strategy/perps_strategy.js`
EMA20/50 crossover, RSI(14), funding rate analysis

#### `src/strategy/kelly.js`
Quarter-Kelly + volatility dampening position sizing

#### `src/safety/rug_check.js`
8-check token safety screen

#### `src/safety/drawdown.js`
30% max drawdown halt + minimum trade/day enforcement

#### `src/safety/stops.js`
3-layer ATR trailing stops (hard SL → trailing SL → time stop)

---

### Day 3 — Execution + AI Decision

#### `src/strategy/compiler.js`
NL → JSON strategy config via LLM

#### `src/execution/twak.js`
TWAK CLI wrapper

#### `src/execution/perps.js`
PancakeSwap perps execution

#### `src/ai/screener.js`
Cheap LLM pre-filter

#### `src/ai/decision.js`
Combined decision pipeline

#### `src/monitoring/telegram.js`
Telegram alerts

---

### Day 4 — Polish + Submit

- Full testnet run
- Drawdown test
- Dashboard
- README.md
- DoraHacks submission

## Setup

### Prerequisites
```bash
# 1. TWAK
curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash

# 2. Clone + install
git clone https://github.com/3scava1i3r/Renaissance
cd Renaissance
npm install

# 3. Environment
cp .env.example .env

# 4. Deploy vault
node scripts/deploy-vault.js

# 5. Register agent identity
python3 scripts/register-agent.py

# 6. Run
npm start
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Agent wallet private key |
| `BSC_RPC` | Yes | BSC RPC endpoint |
| `CMC_API_KEY` | Yes | CoinMarketCap API key |
| `TWAK_ACCESS_ID` | Yes | Trust Wallet API access ID |
| `TWAK_HMAC_SECRET` | Yes | Trust Wallet API secret |
| `VENICE_API_KEY` | No | Venice AI for private reasoning |
| `ANTHROPIC_API_KEY` | No | Fallback LLM |
| `TELEGRAM_BOT_TOKEN` | No | Alert bot |
| `TELEGRAM_CHAT_ID` | No | Alert destination |
