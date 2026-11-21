---
name: chemical-mass-percent-calculation
description: Calculate mass percentages and stoichiometric ratios for chemical reactions and compound compositions.
license: MIT license
metadata:
    skill-author: PJLab
---

# Chemical Mass Percent Calculation

## Usage

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class ChemistryClient:
    def __init__(self, server_url: str, api_key: str):
        self.server_url = server_url
        self.api_key = api_key
        self.session = None

    async def connect(self):
        try:
            self.transport = streamablehttp_client(url=self.server_url, headers={"SCP-HUB-API-KEY": self.api_key})
            self._stack = AsyncExitStack()
            await self._stack.__aenter__()
            self.read, self.write, self.get_session_id = await self._stack.enter_async_context(self.transport)
            self.session_ctx = ClientSession(self.read, self.write)
            self.session = await self._stack.enter_async_context(self.session_ctx)
            await self.session.initialize()
            return True
        except:
            return False

    async def disconnect(self):
        """Disconnect from server"""
        try:
            if hasattr(self, '_stack'):
                await self._stack.aclose()
            print("✓ already disconnect")
        except Exception as e:
            print(f"✗ disconnect error: {e}")
    def parse_result(self, result):
        try:
            if hasattr(result, 'content') and result.content:
                return json.loads(result.content[0].text)
            return str(result)
        except:
            return {"error": "parse error"}

## Initialize and use
client = ChemistryClient("https://scp.intern-ai.org.cn/api/v1/mcp/24/Chemistry_and_Reaction_Calculations", "<your-api-key>")
await client.connect()

# Calculate mass percent of oxygen in H2O
mass_H = 2 * 1.008  # 2 hydrogen atoms
mass_O = 1 * 16.00  # 1 oxygen atom
total_mass = mass_H + mass_O
percent_O = (mass_O / total_mass) * 100
print(f"Mass percent of O in H2O: {percent_O:.2f}%")

await client.disconnect()
```

### Use Cases
- Stoichiometry, analytical chemistry, quality control, reaction yield calculations
