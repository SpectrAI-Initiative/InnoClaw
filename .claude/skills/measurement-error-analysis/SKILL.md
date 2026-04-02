---
name: measurement-error-analysis
description: Analyze measurement errors, uncertainties, and statistical variations in experimental data for quality control.
license: MIT license
metadata:
    skill-author: PJLab
---

# Measurement Error Analysis

## Usage

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession
import numpy as np

class AnalysisClient:
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
client = AnalysisClient("https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis", "<your-api-key>")
await client.connect()

# Analyze measurement errors
measurements = [10.2, 10.5, 10.1, 10.4, 10.3]
mean = np.mean(measurements)
std_dev = np.std(measurements, ddof=1)
std_error = std_dev / np.sqrt(len(measurements))

print(f"Mean: {mean:.2f}")
print(f"Standard deviation: {std_dev:.3f}")
print(f"Standard error: {std_error:.3f}")
print(f"Result: {mean:.2f} ± {std_error:.3f}")

await client.disconnect()
```

### Use Cases
- Experimental physics, quality control, calibration, uncertainty quantification
