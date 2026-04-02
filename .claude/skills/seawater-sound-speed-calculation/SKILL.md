---
name: seawater-sound-speed-calculation
description: Calculate sound speed in seawater from practical salinity, temperature, and pressure using the Gibbs Seawater Oceanographic Toolbox.
license: MIT license
metadata:
    skill-author: PJLab
---

# Seawater Sound Speed Calculation

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
        """Establish connection and initialize session"""
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
        """Parse MCP tool call result"""
        try:
            if hasattr(result, 'content') and result.content:
                content = result.content[0]
                if hasattr(content, 'text'):
                    return json.loads(content.text)
            return str(result)
        except Exception as e:
            return {"error": f"parse error: {e}", "raw": str(result)}
```

### 2. Sound Speed Calculation Workflow

This workflow calculates sound speed in seawater using thermodynamic equations.

**Workflow Steps:**

1. **Calculate Absolute Salinity** - Convert practical salinity to absolute salinity
2. **Calculate Conservative Temperature** - Convert in-situ temperature to conservative temperature
3. **Calculate Sound Speed** - Compute speed of sound in seawater

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

## Input: Seawater properties
input_params = {
    'SP': [35.0, 5.0],           # Practical salinity (PSU)
    't': [15.0, 10.0],           # In-situ temperature (°C)
    'p': [1000.0, 1000.0],       # Pressure (dbar)
    'lon': [120.0, 165.0],       # Longitude (degrees East)
    'lat': [30.0, 45.0]          # Latitude (degrees North)
}

## Step 1: Calculate absolute salinity (SA)
result = await client.session.call_tool(
    "gsw_example_absolute_salinity",
    arguments={
        "SP": input_params['SP'],
        'p': input_params['p'],
        'lon': input_params['lon'],
        'lat': input_params['lat']
    }
)

result_data = client.parse_result(result)
SA_result = result_data["st"]
print("Absolute Salinity:")
for i, sa in enumerate(SA_result):
    print(f"  SP={input_params['SP'][i]} → SA={sa:.4f} g/kg")

## Step 2: Calculate conservative temperature (CT)
result = await client.session.call_tool(
    "gsw_example_conservative_temperature",
    arguments={
        "SA": SA_result,
        't': input_params['t'],
        'p': input_params['p']
    }
)

result_data = client.parse_result(result)
CT_result = result_data["st"]
print("\nConservative Temperature:")
for i, ct in enumerate(CT_result):
    print(f"  t={input_params['t'][i]}°C → CT={ct:.4f}°C")

## Step 3: Calculate sound speed
result = await client.session.call_tool(
    "gsw_example_sound_speed",
    arguments={
        "SA": SA_result,
        'CT': CT_result,
        'p': input_params['p']
    }
)

result_data = client.parse_result(result)
sound_speed_result = result_data["st"]["sound_speed"]

print("\nSound Speed Results:")
for i, speed in enumerate(sound_speed_result):
    print(f"{i+1}. SA={SA_result[i]:.2f} g/kg, CT={CT_result[i]:.2f}°C, p={input_params['p'][i]} dbar")
    print(f"   Sound speed: {speed:.2f} m/s\n")

await client.disconnect()
```

### Tool Descriptions

**OceanGSW-Tool Server:**
- `gsw_example_absolute_salinity`: Calculate absolute salinity
  - Args:
    - `SP` (list): Practical salinity (PSU)
    - `p` (list): Pressure (dbar)
    - `lon` (list): Longitude (degrees East)
    - `lat` (list): Latitude (degrees North)
  - Returns: Absolute salinity (g/kg)

- `gsw_example_conservative_temperature`: Calculate conservative temperature
  - Args:
    - `SA` (list): Absolute salinity (g/kg)
    - `t` (list): In-situ temperature (°C)
    - `p` (list): Pressure (dbar)
  - Returns: Conservative temperature (°C)

- `gsw_example_sound_speed`: Calculate sound speed
  - Args:
    - `SA` (list): Absolute salinity (g/kg)
    - `CT` (list): Conservative temperature (°C)
    - `p` (list): Pressure (dbar)
  - Returns: Sound speed (m/s)

### Input/Output

**Input:**
- `SP`: Practical salinity (0-42 PSU typical range)
- `t`: In-situ temperature (-2 to 40°C)
- `p`: Sea pressure (0-11000 dbar)
- `lon`: Longitude (-180 to 180°E)
- `lat`: Latitude (-90 to 90°N)

**Output:**
- Sound speed in m/s (typically 1400-1600 m/s in ocean)

### Use Cases

- Underwater acoustics and sonar systems
- Ocean circulation modeling
- Submarine navigation
- Marine seismic surveys
- Oceanographic research

### Performance Notes

- **Standards**: TEOS-10 (Thermodynamic Equation of Seawater)
- **Accuracy**: ±0.02 m/s
- **Execution time**: <1 second for batch calculations
