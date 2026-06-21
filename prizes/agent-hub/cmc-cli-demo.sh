#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# CMC CLI Demo — Renaissance Strategy Skill
# Uses CMC CLI to fetch live market data, then backtests
# the Renaissance strategy against it.
#
# Prerequisites:
#   brew install coinmarketcap-official/CoinMarketCap-CLI/cmc
#   cmc auth
#
# Usage:
#   bash prizes/agent-hub/cmc-cli-demo.sh
# ============================================================

echo "═══════════════════════════════════════════"
echo "  Renaissance — CMC CLI Integration Demo"
echo "═══════════════════════════════════════════"

# Step 1: Fetch live prices via CMC CLI
echo ""
echo "▶ Fetching live prices for BTC, ETH, BNB..."
cmc price --id 1,1027,1839 -o json > /tmp/renaissance_cmc_data.json
echo "  ✓ Saved to /tmp/renaissance_cmc_data.json"

# Step 2: Get trending tokens
echo "▶ Fetching trending tokens..."
cmc trending -o json > /tmp/renaissance_trending.json
echo "  ✓ Saved to /tmp/renaissance_trending.json"

# Step 3: Get market metrics
echo "▶ Fetching global market metrics..."
cmc metrics -o json > /tmp/renaissance_metrics.json
echo "  ✓ Saved to /tmp/renaissance_metrics.json"

# Step 4: Merge into a single data file the strategy can consume
echo "▶ Merging data..."
node -e "
const fs = require('fs');
const prices = JSON.parse(fs.readFileSync('/tmp/renaissance_cmc_data.json','utf-8'));
const trending = JSON.parse(fs.readFileSync('/tmp/renaissance_trending.json','utf-8'));
const metrics = JSON.parse(fs.readFileSync('/tmp/renaissance_metrics.json','utf-8'));
fs.writeFileSync('/tmp/renaissance_input.json', JSON.stringify({
  prices, trending, metrics, source: 'cmc-cli', fetchedAt: new Date().toISOString()
}, null, 2));
" 2>/dev/null
echo "  ✓ Merged → /tmp/renaissance_input.json"

# Step 5: Run the Renaissance backtest on live CLI data
echo ""
echo "▶ Running strategy backtest with live CLI data..."
cd "$(dirname "$0")/../.."
node scripts/backtest.js 360 1000 42 auto 2>&1

echo ""
echo "═══════════════════════════════════════════"
echo "  Demo complete. CMC access paths used:"
echo "  • CMC CLI  → price, trending, metrics"
echo "  • REST API → backtest engine"
echo "  • Skill    → renaissance-skill.md"
echo "═══════════════════════════════════════════"