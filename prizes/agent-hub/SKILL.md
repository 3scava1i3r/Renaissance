---
name: renaissance-agent-hub
description: |
  A multi-access integration demonstrating the Renaissance strategy skill through all CMC Agent Hub access paths:
  MCP (Model Context Protocol), CMC CLI (terminal-native), REST API, and pre-built Skills.
  Use this skill to run Renaissance trading signals through any CMC data pipeline.
  Trigger: "renaissance strategy", "agent hub demo", "cmc integration", "/renaissance-agent-hub"
license: MIT
user-invocable: true
allowed-tools:
  - Bash
  - Read
---

# Renaissance — CMC Agent Hub Integration

This skill shows how the Renaissance strategy skill connects to CoinMarketCap through **all four Agent Hub access paths**:

| Path | File | Purpose |
|------|------|---------|
| **MCP** | `mcp.json` | Real-time CMC MCP tools feeding into the strategy |
| **CLI** | `cmc-cli-demo.sh` | Shell-native data pipeline via `cmc` commands |
| **REST API** | `src/data/cmc.js` | Direct API calls for live prices and signals |
| **Pre-built Skill** | `skills/renaissance-skill.md` | The reusable strategy spec for any AI agent |

## MCP Integration

The Renaissance strategy accepts data from the CMC MCP server. Configure in your MCP client:

```json
{
  "mcpServers": {
    "cmc-mcp": {
      "url": "https://mcp.coinmarketcap.com/mcp",
      "headers": {
        "X-CMC-MCP-API-KEY": "your-api-key"
      }
    }
  }
}
```

The CMC MCP provides 12 tools including live quotes, technical analysis (RSI, MACD, EMA), trending narratives, derivatives data, and macro events — all consumed by the Renaissance signal pipeline.

### MCP tools used by Renaissance

| MCP Tool | Strategy Layer | Purpose |
|----------|---------------|---------|
| `get_crypto_quotes_latest` | Layer 1 (Quant Score) | Price, 24h change, volume |
| `get_crypto_technical_analysis` | Layer 2 (Entry/Exit) | RSI, EMA, MACD levels |
| `get_global_crypto_derivatives_metrics` | Layer 2 (Funding Rate) | Funding rates, open interest |
| `get_global_metrics_latest` | Risk overlay | Fear & Greed, market regime |
| `trending_crypto_narratives` | Token selection | Momentum detection |

## CLI Integration

```bash
# Install CMC CLI
brew install coinmarketcap-official/CoinMarketCap-CLI/cmc
cmc auth

# Run the full demo
bash prizes/agent-hub/cmc-cli-demo.sh
```

The demo fetches live prices, trending tokens, and market metrics via `cmc` commands, then feeds them into the Renaissance backtest engine.

## Workflow

```
User query → AI agent
  ├─ MCP path:  CMC MCP server → fetch quotes/TA → Renaissance strategy → signal
  ├─ CLI path:  cmc price + trending → JSON pipeline → Renaissance backtest → result
  └─ API path:  pro-api.coinmarketcap.com → src/data/cmc.js → strategy → decision
```

All three paths converge on the same core strategy in `src/strategy/` — the only difference is how CMC data reaches it.

## Files

| File | Description |
|------|-------------|
| `mcp.json` | MCP server configuration for CMC + Renaissance |
| `cmc-cli-demo.sh` | CLI demo script using `cmc` commands |
| `SKILL.md` | This file — Agent Hub integration skill doc |
| `README.md` | Setup and usage instructions |

See `skills/renaissance-skill.md` for the full strategy specification and backtest results.