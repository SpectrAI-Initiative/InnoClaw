---
name: material-density-volume-calculation
description: Calculate material density and volume from mass and geometric dimensions for materials mechanics analysis.
license: MIT license
metadata:
    skill-author: PJLab
---

# Material Density and Volume Calculation

## Usage

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class PhysicsClient:
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
client = PhysicsClient("https://scp.intern-ai.org.cn/api/v1/mcp/20/Materials_Mechanics_and_Fracture_Analysis", "<your-api-key>")
await client.connect()

# Calculate density from mass and volume
mass = 100  # kg
volume = 0.05  # m³
density = mass / volume
print(f"Density: {density} kg/m³")

await client.disconnect()
```

### Use Cases
- Material property characterization, structural engineering, quality control
