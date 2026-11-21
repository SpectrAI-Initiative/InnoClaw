---
name: seawater-freezing-temperature
description: Calculate the freezing point temperature of seawater from absolute salinity and pressure using GSW thermodynamic equations.
license: MIT license
metadata:
    skill-author: PJLab
---

# Seawater Freezing Temperature Calculation

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class OceanClient:
    """OceanGSW-Tool MCP Client"""

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

### 2. Freezing Temperature Workflow

Calculate the freezing point of seawater based on salinity and pressure.

**Workflow Steps:**

1. **Calculate Absolute Salinity** - Convert practical salinity
2. **Calculate Freezing Temperature** - Compute freezing point

**Implementation:**

```python
## Initialize client
client = OceanClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/34/OceanGSW-Tool",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

## Input parameters
input_params = {
    'SP': [35.0, 5.0],
    'p': [1000.0, 1000.0],
    'lon': [120.0, 165.0],
    'lat': [30.0, 45.0],
    'saturation_fraction': [0.0, 0.0]  # 0=air-free, 1=air-saturated
}

## Step 1: Calculate absolute salinity
result = await client.session.call_tool(
    "gsw_example_absolute_salinity",
    arguments={
        "SP": input_params['SP'],
        'p': input_params['p'],
        'lon': input_params['lon'],
        'lat': input_params['lat']
    }
)

SA_result = client.parse_result(result)["st"]

## Step 2: Calculate freezing temperature
result = await client.session.call_tool(
    "gsw_example_freezing_temp",
    arguments={
        "SA": SA_result,
        "p": input_params['p'],
        "saturation_fraction": input_params['saturation_fraction']
    }
)

t_freeze_result = client.parse_result(result)["st"]["t_freeze"]

print("Freezing Temperature Results:")
for i, t_freeze in enumerate(t_freeze_result):
    print(f"{i+1}. SA={SA_result[i]:.2f} g/kg, p={input_params['p'][i]} dbar")
    print(f"   Freezing temp: {t_freeze:.3f}°C\n")

await client.disconnect()
```

### Tool Descriptions

**OceanGSW-Tool Server:**
- `gsw_example_absolute_salinity`: Convert practical to absolute salinity
- `gsw_example_freezing_temp`: Calculate freezing temperature
  - Args:
    - `SA` (list): Absolute salinity (g/kg)
    - `p` (list): Pressure (dbar)
    - `saturation_fraction` (list): Air saturation (0-1)
  - Returns: Freezing temperature (°C)

### Input/Output

**Input:**
- `SA`: Absolute salinity (0-42 g/kg)
- `p`: Sea pressure (0-11000 dbar)
- `saturation_fraction`: 0 (air-free) to 1 (air-saturated)

**Output:**
- Freezing temperature in °C (typically -2 to 0°C)

### Use Cases

- Sea ice formation prediction
- Polar oceanography
- Marine engineering in cold regions
- Climate modeling

### Performance Notes

- **Standards**: TEOS-10
- **Accuracy**: ±0.001°C
