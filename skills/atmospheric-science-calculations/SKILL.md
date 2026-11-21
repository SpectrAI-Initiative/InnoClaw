---
name: atmospheric-science-calculations
description: Calculate atmospheric parameters including Coriolis parameter, geostrophic wind, heat index, potential temperature, and dewpoint for meteorology and climate science.
license: MIT license
metadata:
    skill-author: PJLab
---

# Atmospheric Science Calculations

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class AtmSciClient:
    """Atmospheric Science Tools MCP Client"""

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

### 2. Atmospheric Calculations Workflow

Calculate key atmospheric parameters for meteorology, climate science, and weather forecasting applications.

**Workflow Steps:**

1. **Calculate Coriolis Parameter** - Compute Earth's rotation effect
2. **Calculate Geostrophic Wind** - Determine wind from pressure gradients
3. **Calculate Heat Index** - Assess human heat stress
4. **Calculate Potential Temperature** - Standardize temperature measurements
5. **Calculate Dewpoint** - Determine moisture content

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

print("=== Atmospheric Science Calculations ===\n")

## Step 1: Calculate Coriolis parameter
print("Step 1: Coriolis Parameter")
latitude = 45.0  # degrees
result = await client.session.call_tool(
    "atm_calc_coriolis_parameter",
    arguments={"latitude": latitude}
)
result_data = client.parse_result(result)
print(f"Latitude: {latitude}°")
print(f"Coriolis parameter: {result_data} s⁻¹\n")

## Step 2: Calculate geostrophic wind
print("Step 2: Geostrophic Wind")
result = await client.session.call_tool(
    "atm_calc_geostrophic_wind",
    arguments={
        "pressure_gradient_x": 1.0,  # Pa/m
        "pressure_gradient_y": 0.5,  # Pa/m
        "latitude": latitude,
        "air_density": 1.225         # kg/m³
    }
)
result_data = client.parse_result(result)
print(f"Geostrophic wind (u, v): {result_data} m/s\n")

## Step 3: Calculate heat index
print("Step 3: Heat Index")
result = await client.session.call_tool(
    "atm_calc_heat_index",
    arguments={
        "temperature_f": 95.0,       # °F
        "relative_humidity": 65.0    # %
    }
)
result_data = client.parse_result(result)
print(f"Temperature: 95°F, Humidity: 65%")
print(f"Heat index: {result_data}°F\n")

## Step 4: Calculate potential temperature
print("Step 4: Potential Temperature")
result = await client.session.call_tool(
    "atm_calc_potential_temperature",
    arguments={
        "temperature_k": 288.15,     # K (15°C)
        "pressure_pa": 85000.0       # Pa (850 hPa)
    }
)
result_data = client.parse_result(result)
print(f"Temperature: 288.15 K, Pressure: 850 hPa")
print(f"Potential temperature: {result_data} K\n")

## Step 5: Calculate dewpoint
print("Step 5: Dewpoint Temperature")
result = await client.session.call_tool(
    "atm_calc_dewpoint",
    arguments={
        "temperature_c": 25.0,       # °C
        "relative_humidity": 60.0    # %
    }
)
result_data = client.parse_result(result)
print(f"Temperature: 25°C, Humidity: 60%")
print(f"Dewpoint: {result_data}°C\n")

## Step 6: Check for heatwave conditions
print("Step 6: Heatwave Detection")
temperatures = [32, 34, 35, 36, 35, 34]  # °C over 6 days
result = await client.session.call_tool(
    "atm_check_heatwave",
    arguments={
        "temperatures": temperatures,
        "threshold": 32.0,           # °C
        "min_duration": 3            # days
    }
)
result_data = client.parse_result(result)
print(f"Temperatures: {temperatures}°C")
print(f"Heatwave detected: {result_data}\n")

await client.disconnect()
```

### Tool Descriptions

**AtmSci-Tool Server:**

- `atm_calc_coriolis_parameter`: Calculate Coriolis parameter (f = 2Ω sin φ)
  - Args: `latitude` (float) - Latitude in degrees
  - Returns: Coriolis parameter in s⁻¹

- `atm_calc_geostrophic_wind`: Calculate geostrophic wind from pressure gradient
  - Args: `pressure_gradient_x`, `pressure_gradient_y` (Pa/m), `latitude` (deg), `air_density` (kg/m³)
  - Returns: Wind components (u, v) in m/s

- `atm_calc_heat_index`: Calculate heat index (apparent temperature)
  - Args: `temperature_f` (°F), `relative_humidity` (%)
  - Returns: Heat index in °F

- `atm_calc_potential_temperature`: Calculate potential temperature
  - Args: `temperature_k` (K), `pressure_pa` (Pa)
  - Returns: Potential temperature in K

- `atm_calc_dewpoint`: Calculate dewpoint temperature
  - Args: `temperature_c` (°C), `relative_humidity` (%)
  - Returns: Dewpoint temperature in °C

- `atm_check_heatwave`: Detect heatwave conditions
  - Args: `temperatures` (list), `threshold` (°C), `min_duration` (days)
  - Returns: Boolean indicating heatwave presence

### Input/Output

**Inputs:**
- Temperatures in K, °C, or °F (as specified)
- Pressures in Pa or hPa
- Relative humidity in %
- Latitude in degrees
- Air density in kg/m³

**Outputs:**
- Coriolis parameter: s⁻¹
- Wind speeds: m/s
- Temperatures: K, °C, or °F
- Boolean flags for conditions

### Use Cases

- Weather forecasting and analysis
- Climate model validation
- Heat stress assessment for public health
- Aviation meteorology
- Agricultural meteorology
- Renewable energy site assessment
- Atmospheric research

### Physical Interpretations

**Coriolis Parameter:**
- Positive in Northern Hemisphere, negative in Southern
- Zero at equator, maximum at poles
- Critical for large-scale atmospheric circulation

**Geostrophic Wind:**
- Theoretical wind resulting from pressure gradient force and Coriolis effect
- Valid above atmospheric boundary layer
- Actual winds deviate due to friction and other forces

**Heat Index:**
- >80°F: Caution (fatigue possible)
- >90°F: Extreme caution (heat exhaustion possible)
- >103°F: Danger (heat stroke likely)
- >125°F: Extreme danger

**Potential Temperature:**
- Temperature air parcel would have if brought adiabatically to reference pressure (1000 hPa)
- Conserved for adiabatic processes
- Used to identify air masses and atmospheric stability

**Dewpoint:**
- Temperature at which air becomes saturated
- Higher dewpoint = more moisture
- Dewpoint > 65°F feels humid
- Dewpoint depression (T - Td) indicates saturation level

### Additional Atmospheric Tools

- `atm_calc_standard_atmosphere`: Calculate standard atmosphere properties
- `generate_synthetic_sounding`: Create atmospheric sounding profiles
- `workflow_storm_diagnosis`: Analyze storm conditions
- `workflow_wind_site_assessment`: Assess wind energy potential
- `geo_calc_distance`: Calculate geographic distances
- `stats_calc_anomaly`: Calculate climate anomalies
- `stats_calc_rolling_mean`: Compute running averages
- `stats_linear_trend`: Determine climate trends
