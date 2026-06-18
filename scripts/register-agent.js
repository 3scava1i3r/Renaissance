// ERC-8004 Agent Identity Registration
// Uses BNBAgent SDK for Python
// Run: python3 scripts/register-agent.py

const script = `#!/usr/bin/env python3
import os
from dotenv import load_dotenv
load_dotenv()

from bnbagent import ERC8004Agent, AgentEndpoint, EVMWalletProvider

wallet = EVMWalletProvider(
    password=os.getenv("WALLET_PASSWORD", "renaissance-agent"),
    private_key=os.getenv("PRIVATE_KEY"),
)

sdk = ERC8004Agent(network="bsc-testnet", wallet_provider=wallet)

agent_uri = sdk.generate_agent_uri(
    name="Renaissance",
    description="Autonomous AI trading agent for BNB Chain perps",
    endpoints=[
        AgentEndpoint(
            name="ERC-8183",
            endpoint="https://renaissance-agent.example.com/erc8183/status",
            version="1.0.0",
        ),
    ],
)

result = sdk.register_agent(agent_uri=agent_uri)
print(f"Agent registered! ID: {result['agentId']}")
print(f"TX: {result['transactionHash']}")

# Save for reference
with open(".agent-identity", "w") as f:
    f.write(f"agent_id={result['agentId']}\\n")
    f.write(f"tx={result['transactionHash']}\\n")
`;

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pyPath = path.resolve(__dirname, 'register-agent.py');

fs.writeFileSync(pyPath, script);
console.log('Wrote register-agent.py');
console.log('');
console.log('Run: python3 scripts/register-agent.py');
console.log('');
console.log('Prerequisites:');
console.log('  pip install bnbagent python-dotenv');
console.log('  BNBAgent SDK: https://github.com/bnb-chain/bnbagent-sdk');
