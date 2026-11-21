---
name: geometric-volume-calculation
description: Calculate volumes of geometric shapes for engineering design and mathematical analysis.
license: MIT license
metadata:
    skill-author: PJLab
---

# Geometric Volume Calculation

## Usage

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession
import math

class GeometryClient:
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
client = GeometryClient("https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations", "<your-api-key>")
await client.connect()

# Calculate sphere volume
radius = 5.0  # cm
volume_sphere = (4/3) * math.pi * radius**3
print(f"Sphere volume: {volume_sphere:.2f} cm³")

# Calculate cylinder volume
height = 10.0  # cm
volume_cylinder = math.pi * radius**2 * height
print(f"Cylinder volume: {volume_cylinder:.2f} cm³")

await client.disconnect()
```

### Use Cases
- CAD design, manufacturing, architectural planning, volume estimation
