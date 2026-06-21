# Renaissance: Self-Evolving Multi-Factor Strategy Skill

**Track:** BNB Hack: AI Trading Agent Edition — **Track 2: Strategy Skills** ($6,000 prize pool)

A quantitative trading strategy skill for the CoinMarketCap AI Agent Hub. Combines multi-factor token scoring, technical regime detection, funding rate analysis, and LLM-driven self-evolution via backtesting.

## Quick Start

```bash
git clone https://github.com/3scava1i3r/Renaissance
cd Renaissance
npm install
```

### Run Backtest

```bash
npm run backtest
```

Outputs Sharpe ratio, max drawdown, win rate, total return, and full trade log.

### Evolve Strategy

```bash
# Optional: set LLM API key for AI-powered mutation
export ANTHROPIC_API_KEY=sk-...

npm run evolve
```

Mutates strategy parameters, backtests each mutation, and promotes the best performer. Results logged to `data/evolution_log.json`.

## Strategy Architecture

```
CMC Data (prices, funding, fear & greed)
   │
   ├─→ Layer 1: Quant Scoring (trend + momentum + volume + relative strength)
   │       ↓
   ├─→ Layer 2: Technical Entry/Exit (EMA crossover + RSI + funding rate)
   │       ↓
   └─→ Layer 3: Position Sizing (Half-Kelly + volatility dampening)
           ↓
      Decision: BUY / SELL / HOLD
```

See `skills/renaissance-skill.md` for the full strategy spec.

## Sponsor Stack

| Sponsor | Component | Usage |
|---------|-----------|-------|
| **CoinMarketCap** | Agent Hub | Prices, funding rates, fear & greed, trending tokens |
| **BNB Chain** | BSC | Eligible token universe (149 BEP-20 tokens) |

## File Structure

```
src/
├── strategy/
│   ├── quant_score.js     # Token scoring engine
│   ├── perps_strategy.js  # EMA/RSI/funding rate strategy
│   └── kelly.js           # Half-Kelly position sizing
├── data/
│   └── cmc.js             # CMC Agent Hub integration
scripts/
├── backtest.js            # Backtesting harness
└── evolve.js              # LLM-driven strategy evolution
skills/
└── renaissance-skill.md   # Strategy Skill spec (submission artifact)
test/
├── strategy.test.js
└── safety.test.js
```

## Submission

Submit `skills/renaissance-skill.md` plus your GitHub repo on DoraHacks. Include backtest results showing Sharpe ratio, max drawdown, win rate, and total return.

**Deadline:** June 21, 2026 17:30 UTC
