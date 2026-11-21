---
name: oceanographic-seawater-properties
description: Calculate seawater thermodynamic properties using TEOS-10 standard including density, salinity, sound speed, and freezing temperature for oceanography.
license: MIT license
metadata:
    skill-author: PJLab
---

# Oceanographic Seawater Properties (TEOS-10)

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class OceanGSWClient:
    """Ocean GSW (Gibbs SeaWater) MCP Client"""

    def __init__(self, server_url: str, api_key: str):
        self.server_url = server_url
        self.api_key = api_key
        self.session = None

    async def connect(self):
        print(f"Connecting to: {self.server_url}")
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
            print("✓ connect success")
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

### 2. Seawater Properties Calculation Workflow

Calculate seawater thermodynamic properties following the TEOS-10 (Thermodynamic Equation of Seawater - 2010) international standard.

**Workflow Steps:**

1. **Convert to Absolute Salinity** - Convert practical salinity to absolute salinity
2. **Calculate Density** - Compute seawater density
3. **Calculate Sound Speed** - Determine speed of sound in seawater
4. **Calculate Freezing Temperature** - Find freezing point
5. **Calculate Conservative Temperature** - Get conservative temperature from potential temperature

**Implementation:**

```python
## Initialize client
client = OceanGSWClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/34/OceanGSW-Tool",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

print("=== Oceanographic Seawater Properties (TEOS-10) ===\n")

## Input parameters for typical ocean conditions
practical_salinity = 35.0  # PSU (practical salinity units)
temperature = 10.0          # °C (in-situ temperature)
pressure = 1000.0           # dbar (approximately 1000m depth)
longitude = -30.0           # degrees E
latitude = 20.0             # degrees N

## Step 1: Convert practical salinity to absolute salinity
print("Step 1: Convert to Absolute Salinity")
result = await client.session.call_tool(
    "SA_from_SP",
    arguments={
        "SP": practical_salinity,
        "p": pressure,
        "lon": longitude,
        "lat": latitude
    }
)
absolute_salinity = client.parse_result(result)
print(f"Practical Salinity: {practical_salinity} PSU")
print(f"Absolute Salinity: {absolute_salinity} g/kg\n")

## Step 2: Calculate seawater density
print("Step 2: Calculate Seawater Density")
result = await client.session.call_tool(
    "rho",
    arguments={
        "SA": absolute_salinity,
        "CT": temperature,
        "p": pressure
    }
)
density = client.parse_result(result)
print(f"Density: {density} kg/m³\n")

## Step 3: Calculate speed of sound
print("Step 3: Calculate Sound Speed")
result = await client.session.call_tool(
    "sound_speed",
    arguments={
        "SA": absolute_salinity,
        "CT": temperature,
        "p": pressure
    }
)
sound_speed = client.parse_result(result)
print(f"Sound Speed: {sound_speed} m/s\n")

## Step 4: Calculate freezing temperature
print("Step 4: Calculate Freezing Temperature")
result = await client.session.call_tool(
    "t_freezing",
    arguments={
        "SA": absolute_salinity,
        "p": pressure,
        "saturation_fraction": 0.0  # 0 for air-free, 1 for air-saturated
    }
)
freezing_temp = client.parse_result(result)
print(f"Freezing Temperature: {freezing_temp}°C\n")

## Step 5: Calculate potential temperature
print("Step 5: Calculate Potential Temperature")
result = await client.session.call_tool(
    "pt_from_t",
    arguments={
        "SA": absolute_salinity,
        "t": temperature,
        "p": pressure,
        "p_ref": 0.0  # Reference pressure (0 for surface)
    }
)
potential_temp = client.parse_result(result)
print(f"In-situ Temperature: {temperature}°C")
print(f"Potential Temperature: {potential_temp}°C\n")

await client.disconnect()
```

### Tool Descriptions

**OceanGSW-Tool Server (TEOS-10 Standard):**

- `SA_from_SP`: Convert practical salinity to absolute salinity
  - Args: `SP` (PSU), `p` (dbar), `lon` (deg E), `lat` (deg N)
  - Returns: Absolute salinity (g/kg)

- `rho`: Calculate seawater density
  - Args: `SA` (g/kg), `CT` (°C), `p` (dbar)
  - Returns: Density (kg/m³)

- `sound_speed`: Calculate speed of sound in seawater
  - Args: `SA` (g/kg), `CT` (°C), `p` (dbar)
  - Returns: Sound speed (m/s)

- `t_freezing`: Calculate freezing temperature
  - Args: `SA` (g/kg), `p` (dbar), `saturation_fraction` (0-1)
  - Returns: Freezing temperature (°C)

- `pt_from_t`: Calculate potential temperature from in-situ temperature
  - Args: `SA` (g/kg), `t` (°C), `p` (dbar), `p_ref` (dbar)
  - Returns: Potential temperature (°C)

### Input/Output

**Inputs:**
- **Practical Salinity (SP)**: PSU (practical salinity units), typically 32-37 for open ocean
- **Absolute Salinity (SA)**: g/kg, accounts for non-salt materials
- **Temperature (t, CT)**: °C, in-situ or conservative temperature
- **Pressure (p)**: dbar, approximately equal to depth in meters
- **Longitude**: degrees East
- **Latitude**: degrees North

**Outputs:**
- Absolute salinity: g/kg
- Density: kg/m³
- Sound speed: m/s
- Freezing temperature: °C
- Potential temperature: °C

### Use Cases

- Oceanographic research and monitoring
- Climate modeling and ocean circulation studies
- Underwater acoustics and sonar applications
- Marine biology habitat characterization
- Ocean engineering and offshore operations
- Fisheries science
- Sea level and ocean heat content studies

### TEOS-10 Overview

TEOS-10 (Thermodynamic Equation of Seawater - 2010) is the international standard for seawater properties:

- Replaces the older EOS-80 standard
- Uses **Absolute Salinity** instead of Practical Salinity
- Uses **Conservative Temperature** instead of Potential Temperature
- Provides consistent thermodynamic framework
- Essential for accurate ocean property calculations

### Physical Interpretations

**Absolute vs Practical Salinity:**
- Practical Salinity: Based on conductivity measurement
- Absolute Salinity: Mass fraction of dissolved material (includes non-salt components)
- Difference typically ~0.5 g/kg but varies regionally

**Seawater Density:**
- Increases with salinity and pressure
- Decreases with temperature
- Typical ocean: 1020-1030 kg/m³
- Critical for ocean circulation and stratification

**Sound Speed:**
- Increases with temperature, salinity, and pressure
- Typical ocean: 1480-1540 m/s
- Critical for sonar, acoustic communication, seismic studies

**Freezing Temperature:**
- Decreases with salinity
- Increases with pressure (unusual property)
- Seawater freezes at ~-2°C at surface

### Additional Ocean Tools

The OceanGSW-Tool server provides 50+ TEOS-10 functions including:
- `alpha`: Thermal expansion coefficient
- `beta`: Haline contraction coefficient
- `chem_potential_water`: Chemical potential
- `cp`: Specific heat capacity
- `enthalpy`: Specific enthalpy
- `entropy`: Specific entropy
- `internal_energy`: Specific internal energy
- `Nsquared`: Brunt-Väisälä frequency (ocean stability)
- `sigma0`, `sigma1`, `sigma2`, `sigma3`, `sigma4`: Potential density anomalies
- `spiciness0`, `spiciness1`, `spiciness2`: Water mass spiciness

### Pressure Conversion

- 1 dbar ≈ 1 meter depth (very close approximation)
- Surface pressure: 0 dbar
- 1000 m depth: ~1000 dbar
- 10000 m depth (Mariana Trench): ~10000 dbar
