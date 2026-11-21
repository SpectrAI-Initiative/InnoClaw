---
name: optical-frequency-calculation
description: Calculate optical frequency and wavelength relationships for photonics and electromagnetic analysis.
license: MIT license
metadata:
    skill-author: PJLab
---

# Optical Frequency Calculation

## Usage

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class OpticsClient:
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
client = OpticsClient("https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics", "<your-api-key>")
await client.connect()

# Calculate frequency from wavelength
c = 3e8  # m/s (speed of light)
wavelength = 532e-9  # m (green laser)
frequency = c / wavelength
print(f"Frequency: {frequency/1e12:.2f} THz")

await client.disconnect()
```

### Use Cases
- Laser physics, optical communications, spectroscopy, photonics engineering
