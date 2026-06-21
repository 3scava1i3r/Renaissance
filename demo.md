# Renaissance — Demo Script

## Prerequisites

```bash
git clone https://github.com/3scava1i3r/Renaissance
cd Renaissance
npm install
cp .env.example .env   # optional — only needed for CMC/Gemini features
```

## 1. Data Fetch (optional — real Binance data)

```bash
npm run fetch-data
```

Downloads 540 4h candles for BTC, ETH, BNB from Binance free API (no key needed).
Falls back to CoinGecko automatically. Saved to `market-data/`.

## 2. Backtest (core demo)

```bash
npm run backtest
```

**Expected output (synthetic, no fetch needed):**

```
{
  "results": {
    "totalReturn": 816.83,          // ≈ 81.7% return
    "sharpeRatio": 17.55,
    "maxDrawdown": 0.62,             // 0.62%
    "winRate": 45,
    "totalTrades": 80,               // 36W / 44L
    "dataSource": "binance"
  }
}
```

With `npm run fetch-data` first, the backtest runs on real 4h klines from
Binance. With no data file, it uses synthetically generated price series.

The results scroll past trade-by-trade, then prints the full JSON summary.

## 3. Strategy Evolution (optional — any free LLM key)

```bash
export GEMINI_API_KEY=your_key_here
npm run evolve
```

Generates 5 mutations per generation using Gemini → NVIDIA NIM fallback chain.
Each mutation is backtested automatically; the best performer graduates.

**Expected output:**

```
[Evolve] Gen 1 — mutated 5 strategies, best Sharpe: 14.20
[Evolve] Gen 2 — mutated 5 strategies, best Sharpe: 16.80
[Evolve] Gen 3 — mutated 5 strategies, best Sharpe: 17.55 ← promoted
```

## 4. Run Tests

```bash
npm test
```

11 tests covering quant scoring, entry/exit logic, Kelly sizing, rug-pull
safety, and drawdown protection. All pass.

## Key Files

| File | Role |
|------|------|
| `src/strategy/quant_score.js` | Multi-token scoring |
| `src/strategy/perps_strategy.js` | EMA/RSI/funding rate entry |
| `src/strategy/kelly.js` | Half-Kelly position sizing |
| `src/data/cmc.js` | CMC Agent Hub integration |
| `skills/renaissance-skill.md` | Strategy Skill spec |
| `scripts/backtest.js` | Backtesting engine |
| `scripts/evolve.js` | LLM-driven evolution |
