# Renaissance — BNB AI Agent SDK Integration

Integrates the Renaissance strategy skill with the [BNBAgent SDK](https://github.com/bnb-chain/bnbagent-sdk) — demonstrating ERC-8004 (on-chain agent identity) and ERC-8183 (trustless commerce) on BNB Chain.

## Prize category

Submitted for **Best Use of BNB AI Agent SDK** ($2,000 special prize).

## What it does

| Component | What | BNB SDK Feature |
|-----------|------|-----------------|
| `register_agent.py` | Registers Renaissance as an on-chain agent | ERC-8004 Identity |
| `agent_server.py` | Accepts token analysis jobs via commerce protocol | ERC-8183 Commerce |

## Setup

```bash
# Python 3.10+ required
pip install -r prizes/bnb-sdk/requirements.txt

# Configure wallet
cp prizes/bnb-sdk/.env.example .env
# Edit .env: set PRIVATE_KEY + WALLET_PASSWORD

# Register agent (gas-free on testnet)
python prizes/bnb-sdk/register_agent.py

# Run server
python prizes/bnb-sdk/agent_server.py
```

## Test

```bash
curl -X POST http://localhost:8004/analyze \
  -H "Content-Type: application/json" \
  -d '{"token": "BTC"}'
```

Returns a Renaissance signal report with buy/sell/hold recommendation and backtest metrics.

## How it works

1. **Registration**: The strategy registers itself as an ERC-8004 agent on BSC Testnet with metadata (strategy params, backtest results, token universe)
2. **Commerce**: A client creates an ERC-8183 job asking "analyze BTC" and funds an escrow
3. **Execution**: Our agent server detects the funded job, runs the Node.js backtest engine via subprocess, generates a signal
4. **Settlement**: The signal is submitted as the deliverable; client can approve or dispute within the window

## Files

| File | What |
|------|------|
| `register_agent.py` | ERC-8004 registration script |
| `agent_server.py` | FastAPI agent server with ERC-8183 endpoints |
| `requirements.txt` | `pip install` dependencies |
| `.env.example` | Wallet and network configuration |
| `SKILL.md` | BNB SDK integration skill spec |
| `README.md` | This file |

## Docs

- [BNBAgent SDK](https://github.com/bnb-chain/bnbagent-sdk)
- [BNB Chain docs](https://docs.bnbchain.org/developer-kit/bnbagent-sdk/)
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004)
- [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183)
