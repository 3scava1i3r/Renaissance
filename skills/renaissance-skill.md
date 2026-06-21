# Renaissance: Self-Evolving Multi-Factor Strategy Skill

A quantitative trading strategy skill for the CoinMarketCap AI Agent Hub that combines multi-factor scoring, technical regime detection, and self-evolution via backtesting.

## Strategy Thesis

Crypto perpetual markets exhibit recurring patterns driven by funding rates, momentum, and sentiment. Most strategies optimize for one signal and fail when market regime shifts. Renaissance blends four independent signal layers — quant score, technical entry/exit, funding rate regime, and position sizing — then uses LLM-driven evolution to continuously improve parameters.

The core insight: **no single signal is reliable, but a blend with dynamic weights adapts to any regime.**

## Data Inputs (CMC Endpoints)

| Data | CMC Endpoint | Purpose |
|------|-------------|---------|
| Prices | `/cryptocurrency/quotes/latest` | Current price, 1h/24h change, volume |
| Funding rates | `/futures/quotes` | Perp funding rate signal |
| Fear & Greed | Alternative.me API | Market sentiment regime |
| Trending tokens | `/cryptocurrency/trending/latest` | Momentum detection |

## Signal Pipeline

```
CMC Data
   │
   ├─→ Layer 1: Quant Scoring (trend + momentum + volume + relative strength)
   │       ↓
   ├─→ Layer 2: Technical Entry/Exit (simulated EMA crossover + RSI + funding rate)
   │       ↓
   └─→ Layer 3: Position Sizing (Half-Kelly with volatility dampening)
           ↓
      Decision: BUY / SELL / HOLD
```

### Layer 1: Quant Score

Scores each token on four factors, blended into a single value from -1 to 1:

| Factor | Weight | Logic |
|--------|--------|-------|
| Trend filter | 33% | Positive 24h change → full weight; negative → half weight |
| Relative strength vs BTC | 25% | Token return minus BTC return, tanh-scaled |
| Volume signal | 25% | tanh of volume above/below $100M threshold |
| 1h momentum | 22% | tanh of 1h percent change |

The final score is `(trend * 0.33 + relStr * 0.25 + vol * 0.25 + momentum * 0.22) * trendFilter` where `trendFilter = change24h > 0 ? 1 : 0.5`.

Tokens with score > 0.3 are considered actionable.

### Layer 2: Technical Entry/Exit

Simulates EMA20/50 crossover using 1h and 24h changes, derives RSI from 24h change, and evaluates funding rate:

**Long entry conditions (all must be met):**
- EMA20 > EMA50 (uptrend)
- Current price > EMA20
- RSI(14) < 70 (not overbought)
- Funding rate negative or neutral (bearish perp market favors longs)

**Short entry conditions (all must be met):**
- EMA20 < EMA50 (downtrend)
- Current price < EMA20
- RSI(14) > 30 (not oversold)

Confidence is set at 0.65–0.75 based on proximity to overbought/oversold thresholds.

**Exit conditions (any triggers exit):**
- RSI crosses above 70 (long exit) or below 30 (short exit)
- Price crosses back through EMA20
- Time stop: close after N periods
- ATR trailing stop triggered

### Layer 3: Position Sizing (Half-Kelly)

Uses a modified Kelly criterion with conservative assumptions:

- **Assumed win rate**: 55% (default, adjusted per strategy)
- **Assumed avg win**: 12%
- **Assumed avg loss**: 5%
- **Kelly raw**: `(winRate * oddsRatio - (1 - winRate)) / oddsRatio`
- **Half-Kelly**: `kellyRaw * 0.25` (quarter-Kelly for safety)
- **Confidence scaling**: 0 at 65% confidence, 1 at 100%
- **Volatility dampening**: `max(0.2, 1 - vol * 0.5 / 10)`
- **Final position**: 2%–20% of portfolio per trade
- **Max leverage**: 5x
- **Max per trade**: $200 (configurable)

## Entry Rules (Exact)

```
IF quant_score.ranked_tokens[0].score > 0.3
AND perps_strategy.signal.direction = "LONG"
AND perps_strategy.signal.confidence >= 0.60
AND portfolio.drawdown < 30%
AND trades_today < 1
THEN BUY with Kelly-sized position
```

## Exit Rules (Exact)

```
IF position.open AND (
  price_crosses_below_ema20 (for longs) OR
  rsi > 70 (for longs) OR
  position_age >= max_hold_periods OR
  trailing_stop_triggered (ATR × 2.7)
)
THEN SELL to close with market order
```

## Risk Parameters

| Parameter | Default | Range |
|-----------|---------|-------|
| Max drawdown | 30% | 10–50% |
| Max leverage | 5x | 1–5x |
| Max position | 20% of portfolio | 2–20% |
| Min trade interval | 4 hours | — |
| Max trades per day | 1 | 1–3 |
| Transaction cost | $0.50 + $0.01 gas | simulated |
| Stop loss | 5% (ATR trailing) | 2–15% |
| Take profit | 5% | 2–15% |

## Optimization Parameters (Evolution Targets)

The following parameters are mutated by the evolution engine:

| Parameter | Default | Evolved Optimum | Evolvable Range |
|-----------|---------|-----------------|-----------------|
| rsiOversoldThreshold | 30 | **39** | 15–45 |
| rsiOverboughtThreshold | 70 | **79** | 55–85 |
| confidenceThreshold | 0.60 | **0.69** | 0.40–0.80 |
| kellyFraction | 0.25 | **0.34** | 0.10–0.50 |
| volDampeningFloor | 0.20 | **0.14** | 0.10–0.50 |
| maxLeverage | 5 | 5 | 1–5 |
| stopLossPct | 5% | **9%** | 2–15% |
| takeProfitPct | 5% | **9%** | 2–15% |

## Self-Evolution Mechanism

The strategy evolves through an LLM-driven optimization loop:

1. **Run backtest** → compute Sharpe ratio, max drawdown, win rate, total return
2. **Score** the current parameter set: `Sharpe * 35 + return * 0.5 - ddPenalty + winRate * 15 + tradeCount * 1`
3. **Generate 3 mutations** via LLM (Venice AI or Anthropic) or random perturbation
4. **Backtest each mutation** using the same historical data
5. **Promote** the mutation with the highest score if it beats the baseline
6. **Log** every generation to `evolution_log.json` for audit trail

This runs continuously, improving the strategy with each generation.

## Backtest Results

Run `npm run backtest` to reproduce. Based on 540 four-hour periods (~90 days) of synthetic market data with deterministic seed 42:

| Metric | Baseline (default params) | After Evolution (optimized) |
|--------|--------------------------|-----------------------------|
| Sharpe ratio | 18.50 | 18.52 |
| Total return | +168.21% | **+609.79%** |
| Max drawdown | 0.40% | 0.54% |
| Win rate | 44.9% | 44.59% |
| Total trades | 49 | 74 |
| Final equity (from $1,000) | $2,682 | **$7,098** |
| Avg win / Avg loss | +$2.98 / -$2.97 | +$5.37 / -$4.73 |

### Evolution-optimized parameters

After 6 generations of LLM-driven evolution, the strategy converged on:

```json
{
  "rsiOversoldThreshold": 39,
  "rsiOverboughtThreshold": 79,
  "confidenceThreshold": 0.69,
  "kellyFraction": 0.34,
  "volDampeningFloor": 0.14,
  "maxLeverage": 5,
  "stopLossPct": 9,
  "takeProfitPct": 9
}
```

## How to Use as a CMC Skill

1. **Load the skill**: Include `renaissance-skill.md` in your agent's skills directory
2. **Configure data sources**: Point to CMC quotes/latest and futures/quotes endpoints
3. **Set parameters**: Adjust risk params and evolution targets via the config block
4. **Run initial backtest**: Execute `npm run backtest` to validate against historical data
5. **Evolve**: Run `npm run evolve` to generate improved parameter sets
6. **Deploy**: Export the best config and use it with your trading agent

## Example Strategy Configurations

### Conservative (default)

```json
{
  "rsiOversoldThreshold": 30,
  "rsiOverboughtThreshold": 70,
  "confidenceThreshold": 0.65,
  "kellyFraction": 0.25,
  "maxLeverage": 3,
  "maxDrawdown": 20,
  "targets": ["ETH", "BTC"],
  "preferredDirection": "LONG"
}
```

### Aggressive

```json
{
  "rsiOversoldThreshold": 25,
  "rsiOverboughtThreshold": 75,
  "confidenceThreshold": 0.55,
  "kellyFraction": 0.35,
  "maxLeverage": 5,
  "maxDrawdown": 30,
  "targets": ["ETH", "BTC", "BNB"],
  "preferredDirection": "BOTH"
}
```

### Funding Rate Focused

```json
{
  "rsiOversoldThreshold": 35,
  "rsiOverboughtThreshold": 65,
  "confidenceThreshold": 0.60,
  "kellyFraction": 0.20,
  "maxLeverage": 3,
  "fundingRateRequired": true,
  "fundingRateDirection": "negative",
  "targets": ["ETH"],
  "preferredDirection": "LONG"
}
```

## Files

| File | Purpose |
|------|---------|
| `src/strategy/quant_score.js` | Token scoring (trend, momentum, volume, rel strength) |
| `src/strategy/perps_strategy.js` | Technical entry/exit signal generation |
| `src/strategy/kelly.js` | Half-Kelly position sizing with volatility dampening |
| `src/data/cmc.js` | CMC Agent Hub data integration |
| `scripts/backtest.js` | Backtesting harness |
| `scripts/evolve.js` | LLM-driven strategy evolution |
| `skills/renaissance-skill.md` | This document — the Skill spec |
