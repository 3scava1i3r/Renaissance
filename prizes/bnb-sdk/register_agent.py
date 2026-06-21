"""
Register Renaissance as an ERC-8004 agent on BSC Testnet.

Usage:
    pip install bnbagent
    cp .env.example .env  # set PRIVATE_KEY + WALLET_PASSWORD
    python prizes/bnb-sdk/register_agent.py
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / ".." / ".."))

from dotenv import load_dotenv
from bnbagent import ERC8004Agent, AgentEndpoint, EVMWalletProvider

load_dotenv()

PRIVATE_KEY = os.getenv("PRIVATE_KEY")
WALLET_PASSWORD = os.getenv("WALLET_PASSWORD")

if not WALLET_PASSWORD:
    print("ERROR: WALLET_PASSWORD is required in .env")
    sys.exit(1)

wallet = EVMWalletProvider(
    password=WALLET_PASSWORD,
    private_key=PRIVATE_KEY,
)

sdk = ERC8004Agent(network="bsc-testnet", wallet_provider=wallet)

agent_uri = sdk.generate_agent_uri(
    name="renaissance-strategy",
    description="Self-evolving multi-factor trading strategy. Scores tokens on trend, momentum, volume, and relative strength. Generates buy/sell/hold signals with Kelly-sized positions. Evolves via LLM-powered backtesting.",
    endpoints=[
        AgentEndpoint(
            name="ERC-8183",
            endpoint="https://renaissance-agent.example.com/erc8183/status",
            version="1.0.0",
        ),
    ],
    metadata={
        "type": "trading-strategy",
        "tokens": "BTC,ETH,BNB",
        "signals": "BUY,SELL,HOLD",
        "evolution": "gemini-3-flash-preview,random",
        "backtest": "real binance data, 540 periods",
        "sharpe": "19.18",
        "total_return": "+444.51%",
    },
)

print(f"Registering Renaissance as ERC-8004 agent on BSC Testnet...")
result = sdk.register_agent(agent_uri=agent_uri)
print(f"  Agent ID: {result['agentId']}")
print(f"  TX: {result['transactionHash']}")
print(f"  View: https://testnet.bscscan.com/tx/{result['transactionHash']}")
print("Done.")
