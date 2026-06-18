# Renaissance — Submission Plan

## BNB Hack: AI Trading Agent Edition — Track 1: Autonomous Trading Agents

### Architecture

```
User NL Strategy  ("long ETH when funding negative, 5x, $200 max")
       │
       ▼
┌──────────────────────┐
│  strategy/compiler.js │ ← LLM compiles NL into JSON config
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   30-min Heartbeat   │
│     (loop.js)        │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  CMC Agent Hub       │ ← prices, funding rates, social, Fear & Greed
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Multi-Layer AI      │
│                      │
│  Layer 1: quant_score│ ← trend, momentum, volume scoring
│  Layer 2: perps_     │ ← EMA20/50, RSI(14), funding rate
│           strategy   │
│  Layer 3: Venice AI  │ ← private TEE final decision
│  Layer 4: kelly      │ ← Quarter-Kelly + vol dampening
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Safety Gate (CHECK) │
│                      │
│  ✓ rug_check (8 detections)│
│  ✓ 30% max drawdown        │
│  ✓ Min 1 trade/day         │
│  ✓ Simulated txn costs     │
│  ✓ ATR trailing stops      │
│  ✓ Eligible token allowlist│
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  TWAK + PancakeSwap  │
│                      │
│  Self-custody signing│
│  BSC perps execution │
│  x402 pay-per-call   │
│  Competition register│
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

### File Structure

```
Renaissance/
├── package.json
├── .env.example
├── plan.md                    ← this file
├── README.md                  ← submission README
├── src/
│   ├── index.js               ← entry point
│   ├── config.js              ← env + constants
│   ├── loop.js                ← 30-min heartbeat
│   ├── data/
│   │   ├── cmc.js             ← CMC Agent Hub
│   │   ├── bsc.js             ← BSC viem RPC
│   │   └── tokens.js          ← 149 eligible BEP-20 allowlist
│   ├── strategy/
│   │   ├── compiler.js        ← NL → JSON compiler
│   │   ├── quant_score.js     ← token scoring engine
│   │   ├── perps_strategy.js  ← EMA/RSI/funding rate
│   │   └── kelly.js           ← position sizing
│   ├── safety/
│   │   ├── rug_check.js       ← token safety
│   │   ├── drawdown.js        ← 30% drawdown halt
│   │   └── stops.js           ← ATR trailing stops
│   ├── execution/
│   │   ├── twak.js            ← TWAK CLI wrapper
│   │   └── perps.js           ← PancakeSwap perps
│   ├── ai/
│   │   ├── screener.js        ← cheap LLM pre-filter
│   │   └── decision.js        ← Venice AI reasoning
│   └── monitoring/
│       ├── journal.js         ← trade log
│       ├── pnl.js             ← PnL tracker
│       ├── telegram.js        ← Telegram alerts
│       └── dashboard.js       ← Express status page
├── contracts/
│   └── TreasuryVault.sol      ← principal-locked vault
├── scripts/
│   ├── deploy-vault.js        ← deploy vault to BSC
│   ├── compete-register.js    ← TWAK competition registration
│   └── test-cycle.js          ← dry run
├── test/
│   ├── strategy.test.js
│   └── safety.test.js
└── data/
    ├── positions.json
    └── trade_journal.jsonl
```

### Sponsor Stack Usage

| Sponsor | Component | How Renaissance Uses It |
|---------|-----------|------------------------|
| **CoinMarketCap** | Agent Hub | `src/data/cmc.js` — prices, funding rates, Fear & Greed, trending tokens, pre-computed signals |
| **Trust Wallet** | Agent Kit (TWAK) | `src/execution/twak.js` — self-custody signing, swap execution, competition registration, x402 |
| **BNB Chain** | BNB AI Agent SDK | `pip install bnbagent` — ERC-8004 identity registration, BSC mainnet execution |
| **BNB Chain** | BSC | `src/data/bsc.js` — on-chain portfolio, balance checks, transaction verification |

### Track 1 Compliance Checklist

- [x] Natural-language strategy in (src/strategy/compiler.js)
- [x] Agent reads markets via CMC (src/data/cmc.js)
- [x] Self-custody signing via TWAK (src/execution/twak.js)
- [x] Trades on BSC (src/execution/perps.js → PancakeSwap perps)
- [x] 30% max drawdown cap (src/safety/drawdown.js)
- [x] Minimum trade count (src/safety/drawdown.js, ≥1/day)
- [x] Simulated transaction costs (src/monitoring/pnl.js)
- [x] Eligible token allowlist (src/data/tokens.js, 149 tokens)
- [x] On-chain competition registration (scripts/compete-register.js)
- [x] Public GitHub repo
- [x] Demo-ready dashboard (src/monitoring/dashboard.js)

### Judging Criteria Mapping

| Criterion | How We Score |
|-----------|--------------|
| **Live PnL** | Quarter-Kelly + volatility dampening + conservative perps strategy = stable returns |
| **30% drawdown cap** | Hard halt at contract level + in-agent check — double safety |
| **Min trade count** | ≥1 trade/day enforced, logged to journal |
| **Simulated txn costs** | $0.50/trade + gas tracked in PnL |
| **TWAK integration depth** | Signing, swap, competition register, x402 — 4 surfaces |
| **Self-custody integrity** | Agent wallet via TWAK, keys never leave user |
| **Autonomous execution** | 30-min heartbeat, no human in loop |
| **Originality** | NL compiler + multi-layer AI + safety-first vault architecture |
| **Demo quality** | Express dashboard + Telegram alerts + dry-run script |

### Setup

```bash
# 1. Install TWAK
curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash

# 2. Clone
git clone https://github.com/3scava1i3r/Renaissance
cd Renaissance
npm install

# 3. Configure
cp .env.example .env
# Fill in: PRIVATE_KEY, BSC_RPC, CMC_API_KEY, TWAK_ACCESS_ID, TWAK_HMAC_SECRET

# 4. Deploy vault
node scripts/deploy-vault.js

# 5. Register on-chain (Track 1)
node scripts/compete-register.js

# 6. Run
npm start

# 7. View dashboard
# http://localhost:3000
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRIVATE_KEY` | Yes | — | Agent wallet private key |
| `AGENT_WALLET` | Yes | — | Agent wallet address |
| `BSC_RPC` | Yes | `https://bsc-dataseed.binance.org` | BSC RPC endpoint |
| `CMC_API_KEY` | Yes | — | CoinMarketCap Pro API key |
| `TWAK_ACCESS_ID` | Yes | — | Trust Wallet API access ID |
| `TWAK_HMAC_SECRET` | Yes | — | Trust Wallet API HMAC secret |
| `STRATEGY_NL` | No | `long ETH perps` | Natural-language strategy |
| `VENICE_API_KEY` | No | — | Venice AI private reasoning |
| `ANTHROPIC_API_KEY` | No | — | Fallback LLM for screening |
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram alert bot token |
| `TELEGRAM_CHAT_ID` | No | — | Telegram alert chat ID |
| `VAULT_ADDRESS` | No | — | Deployed TreasuryVault address |
| `MAX_DRAWDOWN_PCT` | No | 30 | Drawdown halt threshold |
| `MAX_LEVERAGE` | No | 5 | Maximum leverage |
| `CYCLE_INTERVAL_MS` | No | 1800000 | Cycle interval (30min) |

### Competition Contract

- **Address:** `0x212c61b9b72c95d95bf29cf032f5e5635629aed5`
- **Network:** BSC Mainnet (chain ID 56)
- **Registration:** Via TWAK CLI: `twak compete register`
- **Deadline:** June 21, 2026 17:30 UTC
- **Trading window:** June 22–28, 2026

### Eligible Tokens (149 BEP-20)

ETH, USDT, USDC, XRP, TRX, DOGE, ZEC, ADA, LINK, BCH, DAI, TON, USD1, USDe, M, LTC, AVAX, SHIB, XAUt, WLFI, H, DOT, UNI, ASTER, DEXE, USDD, ETC, AAVE, ATOM, U, STABLE, FIL, INJ, NIGHT, FET, TUSD, BONK, PENGU, CAKE, SIREN, LUNC, ZRO, KITE, FDUSD, BEAT, PIEVERSE, BTT, NFT, EDGE, FLOKI, LDO, B, FF, PENDLE, NEX, STG, AXS, TWT, HOME, RAY, COMP, GWEI, XCN, GENIUS, XPL, BAT, SKYAI, APE, IP, SFP, TAG, NXPC, AB, SAHARA, 1INCH, CHEEMS, BANANAS31, RIVER, MYX, RAVE, SNX, FORM, LAB, HTX, USDf, CTM, BDX, SLX, UB, DUCKY, FRAX, BILL, WFI, KOGE, ALE, FRXUSD, USDF, GOMINING, VCNT, GUA, DUSD, SMILEK, 0G, BEAM, MY, SOON, REAL, Q, AIOZ, ZIG, YFI, TAC, lisUSD, CYS, ZAMA, TRIA, HUMA, PLUME, ZIL, XPR, ZETA, BabyDoge, NILA, ROSE, VELO, UAI, BRETT, OPEN, BSB, TOSHI, BAS, ACH, AXL, LUR, ELF, KAVA, APR, IRYS, EURI, XUSD, BARD, DUSK, SUSHI, PEAQ, COAI, BDCA, XAUM

### Timeline

| Date | Event |
|------|-------|
| June 18–21 | Build + submit |
| June 22 00:00 UTC | Trading window opens |
| June 28 23:59 UTC | Trading window closes |
| June 29 – July 5 | Judging |
| Week of July 6 | Winners announced |
