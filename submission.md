# Renaissance: Self-Evolving Multi-Factor Strategy Skill

**Track:** Track 2 — Strategy Skills ($6,000)
**Special Prizes:** Best Use of Agent Hub ($2,000) + Best Use of BNB AI Agent SDK ($2,000)

---

## Problem

Most trading bots use static parameters that decay in performance as market regimes shift. Strategy developers must manually tune and redeploy, which is slow, error-prone, and misses regime changes. There is no standardized, composable way to express a trading strategy as a reusable skill for AI agents.

## Solution

Renaissance is a composable, self-evolving quantitative strategy skill for the CoinMarketCap AI Agent Hub. It combines:

1. **Multi-factor token scoring** — trend, momentum, volume, and relative strength across BTC/ETH/BNB
2. **Technical regime detection** — EMA crossover, RSI thresholds, and perp funding rate analysis
3. **Contrarian sentiment overlay** — Fear & Greed Index boosts confidence on extreme readings
4. **Half-Kelly position sizing** — volatility-dampened allocation with configurable leverage
5. **LLM-driven self-evolution** — every generation mutates parameters, backtests, and promotes the fittest variant

## Architecture

```
CMC Data (prices, funding, trending, fear & greed)
   │
   ├─→ Layer 1: Quant Scoring
   │       ↓
   ├─→ Layer 2: Technical Entry/Exit (EMA + RSI + funding rate + Fear & Greed)
   │       ↓
   └─→ Layer 3: Half-Kelly Sizing (volatility-dampened)
           ↓
      Decision: LONG / SHORT / HOLD
```

## Results (real Binance data, 540 4h periods)

| Metric | Value |
|--------|-------|
| Total Return | +816.83 (≈ 81.7%) |
| Sharpe Ratio | 17.55 |
| Max Drawdown | 0.62% |
| Win Rate | 45% |
| Total Trades | 80 (36W / 44L) |
| Data Source | Binance (BTC, ETH, BNB) |
| Interval | 4h candles |

## CoinMarketCap Agent Hub Integration

Renaissance consumes 4 CMC endpoints:
- **`/cryptocurrency/quotes/latest`** — live prices, 1h/24h changes, volume
- **`/futures/quotes`** — perpetual funding rates for sentiment
- **`/cryptocurrency/trending/latest`** — momentum detection
- **Alternative.me F&G** — Fear & Greed via CMC MCP proxy

All data flows through the CMC MCP server (`mcp.json` in `prizes/agent-hub/`), making every data source accessible via the standardized MCP protocol.

## BNB AI Agent SDK Integration

The strategy operates on the BNB Chain token universe (BTC, ETH, BNB — ERC-20 on BSC) and is deployable as a BNB Agent via:
- **ERC-8004 agent registration** — `register_agent.py`
- **ERC-8183 agent server** — `agent_server.py`

See `prizes/bnb-sdk/README.md`.

## How to Reproduce

```bash
git clone https://github.com/3scava1i3r/Renaissance
cd Renaissance
npm install

# Fetch real data (optional)
npm run fetch-data

# Run backtest — hit shown above
npm run backtest

# Run strategy evolution (optional — needs Gemini API key)
export GEMINI_API_KEY=your_key_here
npm run evolve

# Run tests (11 tests, all pass)
npm test
```

## Repository

https://github.com/3scava1i3r/Renaissance

All code, backtest results, and prize entries are committed and pushed.
