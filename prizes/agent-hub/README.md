# Renaissance — CMC Agent Hub Integration

This folder demonstrates the Renaissance strategy skill integrated with **3 of 4 CMC Agent Hub access paths**, alongside the pre-built Skill in `skills/renaissance-skill.md`.

## What's covered

| CMC Access Path | How | Run It |
|-----------------|-----|--------|
| **MCP** | `mcp.json` configures the CMC MCP server — 12 tools for quotes, TA, news, derivatives, on-chain data | Add to your MCP client's config |
| **CMC CLI** | `cmc-cli-demo.sh` fetches live prices + trending + metrics via `cmc` commands, feeds into backtest | `bash cmc-cli-demo.sh` |
| **REST API** | `src/data/cmc.js` calls `/v2/cryptocurrency/quotes/latest` directly | Already used in `src/` |
| **Pre-built Skill** | `skills/renaissance-skill.md` — reusable strategy spec for AI agents | Copy to your agent's skills dir |

## Prerequisites

- `CMC_API_KEY` in `.env` (for REST API)
- **For MCP:** MCP-compatible client (Cursor, Claude Code, Windsurf)
- **For CLI:** `brew install cmc` then `cmc auth`

## MCP Setup

Add to your MCP client configuration:

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

## CLI Demo

```bash
# One command
bash prizes/agent-hub/cmc-cli-demo.sh
```

This runs: `cmc price` → `cmc trending` → `cmc metrics` → merge → Renaissance backtest.

## Files

| File | What |
|------|------|
| `mcp.json` | MCP server config for CMC + Renaissance strategy |
| `cmc-cli-demo.sh` | End-to-end CLI demo script |
| `SKILL.md` | Agent Hub integration skill doc (CMC Skill format) |
| `README.md` | This file |

## Prize category

Submitted for **Best Use of Agent Hub** ($2,000 special prize) — demonstrating Renaissance across MCP, CLI, REST API, and pre-built Skill access paths.
