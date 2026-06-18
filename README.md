# Renaissance

Autonomous AI trading agent for BNB Chain — natural-language strategy in, on-chain execution out.

**Track:** BNB Hack: AI Trading Agent Edition — Track 1: Autonomous Trading Agents ($24,000 prize pool)

## Architecture

```
User NL Strategy  ("long ETH when funding negative, 5x, $200 max")
       │
       ▼
┌──────────────────────┐
│  strategy/compiler.js │  ← LLM compiles NL into JSON config
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   30-min Heartbeat   │
│     (loop.js)        │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  CMC Agent Hub       │  ← prices, funding rates, Fear & Greed
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Multi-Layer AI      │
│                      │
│  Layer 1: quant_score│  ← trend, momentum, volume scoring
│  Layer 2: perps_     │  ← EMA20/50, RSI(14), funding rate
│           strategy   │
│  Layer 3: Venice AI  │  ← private TEE final decision
│  Layer 4: kelly      │  ← Quarter-Kelly + vol dampening
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Safety Gate (CHECK) │
│                      │
│  ✓ rug_check (8 checks)     │
│  ✓ 30% max drawdown         │
│  ✓ Min 1 trade/day          │
│  ✓ Simulated txn costs      │
│  ✓ ATR trailing stops       │
│  ✓ Eligible token allowlist │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  TWAK + PancakeSwap  │
│                      │
│  Self-custody signing│
│  BSC perps execution │
│  x402 pay-per-call   │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Monitoring          │
│                      │
│  Trade journal       │
│  PnL + drawdown      │
│  Telegram alerts     │
│  Dashboard (Express) │
└──────────────────────┘
```

## Quick Start

### Prerequisites

```bash
# Install TWAK (Trust Wallet Agent Kit)
curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash

# Clone
git clone https://github.com/3scava1i3r/Renaissance
cd Renaissance
npm install
```

### Configure

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Agent wallet private key |
| `AGENT_WALLET` | Yes | Agent wallet address |
| `BSC_RPC` | Yes | BSC RPC endpoint |
| `CMC_API_KEY` | Yes | CoinMarketCap Pro API key |
| `TWAK_ACCESS_ID` | Yes | Trust Wallet API access ID |
| `TWAK_HMAC_SECRET` | Yes | Trust Wallet API HMAC secret |
| `VENICE_API_KEY` | No | Venice AI private reasoning |
| `ANTHROPIC_API_KEY` | No | Fallback LLM for screening |
| `TELEGRAM_BOT_TOKEN` | No | Telegram alert bot token |
| `TELEGRAM_CHAT_ID` | No | Telegram alert chat ID |
| `STRATEGY_NL` | No | Natural-language strategy (see below) |

### Competition Registration (One-Time)

```bash
# Automatically deploys vault + registers on competition contract
node scripts/compete-register.js

# Or if TWAK is not installed, direct contract call:
node scripts/compete-register.js --direct
```

This registers your agent on the competition contract `0x212c61b9b72c95d95bf29cf032f5e5635629aed5` (BSC mainnet).

### Run

```bash
# Test first
npm test
npm run dry

# Start live agent
npm start
```

### View Dashboard

Open http://localhost:3000 to see:
- Portfolio value, PnL, drawdown %
- Trade history
- Configuration overview
- Agent status

## Natural Language Strategy

Set `STRATEGY_NL` in your `.env` to define your strategy in plain English:

```env
STRATEGY_NL="long ETH perps when funding negative and RSI < 30, 5x leverage, max 30% drawdown, $200 per trade"
```

The compiler (`src/strategy/compiler.js`) parses this into structured JSON the agent follows.

Example strategies:
- `"long ETH when funding negative and RSI < 30, 5x, max $200"`
- `"short BTC when RSI > 70, 3x leverage, 20% drawdown limit"`
- `"long BNB when volume spikes >2x average, 3x, $150 per trade"`

## Competition Rules Compliance

| Rule | Implementation |
|------|---------------|
| 30% max drawdown | `src/safety/drawdown.js` — hard halt at configurable threshold |
| Min 1 trade/day | `src/safety/drawdown.js` — enforced via journal trade count |
| Simulated txn costs | `src/monitoring/pnl.js` — $0.50/trade + $0.01 gas |
| On-chain registration | `scripts/compete-register.js` — competition contract on BSC |
| 149 eligible tokens | `src/data/tokens.js` — allowlist checked at strategy and execution |
| Self-custody | TWAK unlock-once, keys never leave user |
| Autonomous execution | 30-min heartbeat, no human in loop |
| Demo-ready | Express dashboard at port 3000 + Telegram alerts |

## Sponsor Stack

| Sponsor | Component | Usage |
|---------|-----------|-------|
| **CoinMarketCap** | Agent Hub | Prices, funding rates, Fear & Greed, trending tokens |
| **Trust Wallet** | Agent Kit (TWAK) | Self-custody signing, swap execution, competition registration, x402 |
| **BNB Chain** | BSC + BNB AI Agent SDK | ERC-8004 identity registration, on-chain execution |

## File Structure

```
src/
├── index.js              # Entry point — starts dashboard + loop
├── config.js             # Environment config + rules
├── loop.js               # 30-min heartbeat cycle
├── data/
│   ├── cmc.js            # CMC Agent Hub integration
│   ├── bsc.js            # BSC on-chain data
│   └── tokens.js         # 149 eligible BEP-20 token allowlist
├── strategy/
│   ├── compiler.js       # NL → JSON strategy compiler
│   ├── quant_score.js    # Token scoring engine
│   ├── perps_strategy.js # EMA/RSI/funding rate strategy
│   └── kelly.js          # Quarter-Kelly position sizing
├── safety/
│   ├── rug_check.js      # 8-check token safety
│   ├── drawdown.js       # 30% max drawdown enforcement
│   └── stops.js          # ATR trailing stops
├── execution/
│   ├── twak.js           # TWAK CLI wrapper
│   └── perps.js          # PancakeSwap perps execution
├── ai/
│   ├── screener.js       # LLM pre-filter
│   └── decision.js       # Multi-layer AI decision
└── monitoring/
    ├── journal.js        # Trade journal
    ├── pnl.js            # PnL + drawdown tracking
    ├── telegram.js       # Telegram alerts
    └── dashboard.js      # Express status page
```

## Demo Instructions

1. Start the agent: `npm start`
2. Open dashboard: http://localhost:3000
3. Wait for a cycle to complete (30 min or run `npm run dry`)
4. Record 2-min video showing:
   - Terminal with agent running
   - Dashboard with portfolio stats
   - Trade journal entries
5. Submit on DoraHacks with GitHub repo + demo video link

## Deadline

**June 21, 2026 17:30 UTC** — submissions close
Trading window: June 22–28, 2026
