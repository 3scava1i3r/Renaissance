# Renaissance

Autonomous AI trading agent for BNB Chain. Natural-language strategy in, on-chain execution out.

**Track:** BNB Hack: AI Trading Agent Edition — Track 1: Autonomous Trading Agents ($24,000)

## Architecture

```
User NL → Compiler → 30min Loop → CMC Data → Multi-Layer AI → Safety Gate → TWAK → BSC Perps
```

## Quick Start

```bash
# Prerequisites
curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash
npm install

# Configure
cp .env.example .env
# Edit .env with your keys

# Deploy vault
node scripts/deploy-vault.js

# Register agent identity
python3 scripts/register-agent.py

# Run
npm start
```

## Test

```bash
npm test            # Unit tests
npm run dry         # Dry run test cycle
npm start           # Live agent
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Agent wallet private key |
| `BSC_RPC` | Yes | BSC RPC endpoint |
| `CMC_API_KEY` | Yes | CoinMarketCap API key |
| `TWAK_ACCESS_ID` | Yes | Trust Wallet API access ID |
| `TWAK_HMAC_SECRET` | Yes | Trust Wallet API secret |
| `VENICE_API_KEY` | No | Venice AI private reasoning |
| `ANTHROPIC_API_KEY` | No | Fallback LLM |
| `TELEGRAM_BOT_TOKEN` | No | Alert bot |
| `TELEGRAM_CHAT_ID` | No | Alert destination |
| `STRATEGY_NL` | No | Natural language strategy |

## Natural Language Strategy

Set `STRATEGY_NL` in your `.env` to define your strategy in plain English:

```
STRATEGY_NL="long ETH perps when funding negative and RSI < 30, 5x leverage, max 30% drawdown, $200 per trade"
```

The compiler parses this into structured JSON the agent follows.

## Competition Rules

- **30% max drawdown** — agent halts if exceeded
- **Min 1 trade/day** — enforced during competition week
- **Simulated txn costs** — deducted from PnL
- **On-chain proof** — agent address registered on BSC

## Stack

- **Data:** CoinMarketCap Agent Hub (prices, funding, social, signals)
- **Signing:** Trust Wallet Agent Kit (self-custody, unlock-once)
- **Execution:** PancakeSwap perps on BSC via TWAK
- **Identity:** BNBAgent SDK (ERC-8004)
- **AI:** Venice AI (private TEE reasoning), Anthropic (screening)
- **Safety:** TreasuryVault (principal-locked), 8-check rug detection, ATR trailing stops

## File Structure

```
Renaissance/
├── src/
│   ├── index.js              # Entry point
│   ├── config.js             # Environment config
│   ├── loop.js               # 30-min heartbeat cycle
│   ├── data/
│   │   ├── cmc.js            # CMC Agent Hub integration
│   │   └── bsc.js            # BSC on-chain data
│   ├── strategy/
│   │   ├── compiler.js       # NL → JSON strategy compiler
│   │   ├── quant_score.js    # Token scoring engine
│   │   ├── perps_strategy.js # EMA/RSI/funding rate strategy
│   │   └── kelly.js          # Quarter-Kelly position sizing
│   ├── safety/
│   │   ├── rug_check.js      # 8-check token safety
│   │   ├── drawdown.js       # 30% max drawdown enforcement
│   │   └── stops.js          # ATR trailing stops
│   ├── execution/
│   │   ├── twak.js           # TWAK CLI wrapper
│   │   └── perps.js          # PancakeSwap perps execution
│   ├── ai/
│   │   ├── screener.js       # Cheap LLM pre-filter
│   │   └── decision.js       # Multi-layer AI decision
│   └── monitoring/
│       ├── journal.js        # Trade journal
│       ├── pnl.js            # PnL tracker
│       └── telegram.js       # Telegram alerts
├── contracts/
│   └── TreasuryVault.sol     # Principal-locked yield vault
├── scripts/
│   ├── deploy-vault.js
│   ├── register-agent.js
│   └── test-cycle.js
├── test/
│   ├── strategy.test.js
│   └── safety.test.js
└── data/
    ├── positions.json
    ├── trade_journal.jsonl
    ├── cycle_summary.md
    └── pnl_state.json
```
