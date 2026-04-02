---
name: wind-site-assessment
description: Assess wind energy potential and perform site analysis using atmospheric science calculations.
license: MIT license
metadata:
    skill-author: PJLab
---

# Wind Site Assessment

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class AtmSciClient:
    """AtmSci-Tool MCP Client"""

    def __init__(self, server_url: str, api_key: str):
        self.server_url = server_url
        self.api_key = api_key
        self.session = None

    async def connect(self):
        try:
            self.transport = streamablehttp_client(
                url=self.server_url,
                headers={"SCP-HUB-API-KEY": self.api_key}
            )
            self._stack = AsyncExitStack()
            await self._stack.__aenter__()
            self.read, self.write, self.get_session_id = await self._stack.enter_async_context(self.transport)
            self.session_ctx = ClientSession(self.read, self.write)
            self.session = await self._stack.enter_async_context(self.session_ctx)
            await self.session.initialize()
            return True
        except Exception as e:
            print(f"✗ connect failure: {e}")
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
                content = result.content[0]
                if hasattr(content, 'text'):
                    return json.loads(content.text)
            return str(result)
        except Exception as e:
            return {"error": f"parse error: {e}", "raw": str(result)}
```

### 2. Wind Site Assessment Workflow

Evaluate wind energy potential at a specific location.

**Implementation:**

```python
## Initialize client
client = AtmSciClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/35/AtmSci-Tool",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

## Input: Wind measurements
wind_speeds = [6.5, 7.2, 8.1, 5.9, 9.3]  # m/s at hub height
hub_height = 80  # meters
air_density = 1.225  # kg/m³

## Calculate wind power and assess site viability
# Note: Use appropriate atmospheric science tools
result = await client.session.call_tool(
    "wind_power_assessment",
    arguments={
        "wind_speeds": wind_speeds,
        "hub_height": hub_height,
        "air_density": air_density
    }
)

assessment = client.parse_result(result)
print(f"Average wind speed: {assessment['avg_speed']:.2f} m/s")
print(f"Wind power density: {assessment['power_density']:.2f} W/m²")
print(f"Site classification: {assessment['classification']}")

await client.disconnect()
```

### Use Cases

- Wind farm site selection
- Renewable energy assessment
- Atmospheric boundary layer studies
- Wind resource mapping
