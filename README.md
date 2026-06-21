# Renaissance: Self-Evolving Multi-Factor Strategy Skill

**Track:** BNB Hack: AI Trading Agent Edition — **Track 2: Strategy Skills** ($6,000 prize pool)

A quantitative trading strategy skill for the CoinMarketCap AI Agent Hub. Combines multi-factor token scoring, technical regime detection, funding rate analysis, and LLM-driven self-evolution via backtesting.

## Quick Start

```bash
git clone https://github.com/3scava1i3r/Renaissance
cd Renaissance
npm install
```

### 1. Fetch Real Market Data (optional)

```bash
npm run fetch-data
```

Pulls 540 candles at 4h intervals for BTC, ETH, BNB from Binance free API (no key needed).

### 2. Run Backtest

```bash
npm run backtest
```

Uses real data if fetched, otherwise synthetic. Outputs Sharpe ratio, max drawdown, win rate, total return, and full trade log.

### 3. Evolve Strategy

```bash
# Set API key for AI-powered mutation (optional)
export VENICE_API_KEY=your_key_here

npm run evolve
```

Mutates strategy parameters, backtests each mutation, and promotes the best performer. Uses LLM when API key is set, otherwise random perturbation.

## Data Sources

| Source | How | Key needed |
|--------|-----|------------|
| **Binance** | `npm run fetch-data` | No — free public API |
| **CoinGecko** | Fallback in fetch-data | No |
| **CMC** | Live data via `CMC_API_KEY` | Yes |
| **Synthetic** | Default backtest | No |

## Strategy Architecture

```
CMC/Binance Data (prices, funding, fear & greed)
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
├── evolve.js              # Strategy evolution engine
└── fetch-data.js          # Binance/CoinGecko data fetcher
skills/
└── renaissance-skill.md   # Strategy Skill spec (submission artifact)
test/
├── strategy.test.js
└── safety.test.js
```

## Submission

Submit your GitHub repo on DoraHacks. Run `npm run backtest` and include the results in your description. For best results, run `npm run fetch-data` first for real market data.

**Deadline:** June 21, 2026 17:30 UTC
