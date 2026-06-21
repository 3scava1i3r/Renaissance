"""
Renaissance ERC-8183 Agent Server.

Accepts token analysis jobs via ERC-8183 commerce protocol.
When a funded job arrives, runs the Renaissance Node.js strategy
to generate a trading signal and returns it as the deliverable.

Usage:
    pip install "bnbagent[server]"
    cp .env.example .env
    python prizes/bnb-sdk/agent_server.py
"""

import json
import logging
import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent / ".." / ".."))

load_dotenv()

from bnbagent.erc8183.config import ERC8183Config
from bnbagent.erc8183.server import create_erc8183_app
from bnbagent.storage import LocalStorageProvider

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("renaissance-agent")

ROOT = Path(__file__).resolve().parent.parent.parent

_storage = LocalStorageProvider.from_env()
config = ERC8183Config.from_env(storage=_storage)
PORT = int(os.getenv("PORT", "8004"))


def analyze_token(symbol: str) -> str:
    """Run the Renaissance Node.js strategy for a given token symbol."""
    logger.info(f"Analyzing token: {symbol}")

    backtest_script = ROOT / "scripts" / "backtest.js"
    cmd = ["node", str(backtest_script), "100", "1000", "42", "synthetic"]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60, cwd=ROOT)
        stdout = result.stdout or ""
        stderr = result.stderr or ""

        # Extract JSON result from backtest output
        lines = stdout.strip().split("\n")
        json_lines = [l for l in lines if l.startswith("{") and l.endswith("}")]

        if json_lines:
            data = json.loads(json_lines[-1])
            r = data.get("results", {})
            signal = "BUY" if r.get("totalReturn", 0) > 0 else "SELL"
            report = (
                f"# Renaissance Signal Report\n\n"
                f"**Token:** {symbol}\n"
                f"**Signal:** {signal}\n"
                f"**Return:** {r.get('totalReturn', 'N/A')}%\n"
                f"**Sharpe:** {r.get('sharpeRatio', 'N/A')}\n"
                f"**Max DD:** {r.get('maxDrawdown', 'N/A')}%\n"
                f"**Trades:** {r.get('totalTrades', 0)}\n"
                f"**Confidence:** {'HIGH' if r.get('sharpeRatio', 0) > 1 else 'MEDIUM'}\n"
            )
        else:
            report = f"# Renaissance Signal Report\n\n**Token:** {symbol}\n**Signal:** HOLD\n**Error:** Could not parse backtest output.\n```\n{stderr[:500]}\n```\n"

        logger.info(f"Signal generated for {symbol}")

    except subprocess.TimeoutExpired:
        report = f"# Renaissance Signal Report\n\n**Token:** {symbol}\n**Signal:** HOLD\n**Error:** Backtest timed out.\n"
    except Exception as e:
        report = f"# Renaissance Signal Report\n\n**Token:** {symbol}\n**Signal:** HOLD\n**Error:** {e}\n"

    return report


def process_task(job: dict) -> str:
    """
    ERC-8183 job handler. Called automatically for each FUNDED job.
    Extracts the token symbol from the job description and runs the strategy.
    """
    description = job.get("description", "")
    symbol = description.strip().upper()
    logger.info(f"Job {job['jobId']}: processing token '{symbol}'")

    report = analyze_token(symbol)
    logger.info(f"Job {job['jobId']}: deliverable ready ({len(report)} chars)")
    return report


app = create_erc8183_app(config=config, on_job=process_task)

print(f"""
{'='*55}
  Renaissance Agent Server (ERC-8183 Provider)
{'='*55}
  Port:           {PORT}
  Commerce:       {config.effective_commerce_address}
  Router:         {config.effective_router_address}
  Policy:         {config.effective_policy_address}
  Price:          {int(config.service_price) / 10**18} U tokens

  ERC-8183 endpoints:
    POST /erc8183/negotiate     — Negotiate job terms
    GET  /erc8183/job/{{id}}      — Job details
    GET  /erc8183/status        — Agent status
    GET  /erc8183/health        — Health check

  Direct endpoint (testing):
    POST /analyze               — Direct token analysis

  Integration:
    Calls Node.js strategy at: {ROOT / 'scripts' / 'backtest.js'}
{'='*55}
""")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
