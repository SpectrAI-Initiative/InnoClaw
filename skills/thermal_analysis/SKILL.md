---
name: thermal_analysis
description: "Thermal & Heat Transfer Analysis - Analyze thermal system: calculate heat released, convert energy units, compute potential energy, and dynamic viscosity. Use this skill for thermal engineering tasks involving calculate heat released convert energy MeV to J calculate potential energy calculate dynamic viscosity. Combines 4 tools from 1 SCP server(s)."
---

# Thermal & Heat Transfer Analysis

**Discipline**: Thermal Engineering | **Tools Used**: 4 | **Servers**: 1

## Description

Analyze thermal system: calculate heat released, convert energy units, compute potential energy, and dynamic viscosity.

## Tools Used

- **`calculate_heat_released`** from `server-22` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/22/Thermal_Fluid_Dynamics`
- **`convert_energy_MeV_to_J`** from `server-22` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/22/Thermal_Fluid_Dynamics`
- **`calculate_potential_energy`** from `server-22` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/22/Thermal_Fluid_Dynamics`
- **`calculate_dynamic_viscosity`** from `server-22` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/22/Thermal_Fluid_Dynamics`

## Workflow

1. Calculate heat released
2. Convert energy MeV to Joules
3. Calculate potential energy
4. Compute dynamic viscosity

## Test Case

### Input
```json
{
    "energy_MeV": 5.0,
    "mass": 10.0,
    "height": 5.0
}
```

### Expected Steps
1. Calculate heat released
2. Convert energy MeV to Joules
3. Calculate potential energy
4. Compute dynamic viscosity

## Usage Example

> **Note:** Replace `sk-b04409a1-b32b-4511-9aeb-22980abdc05c` with your own SCP Hub API Key. You can obtain one from the [SCP Platform](https://scphub.intern-ai.org.cn).

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from mcp.client.sse import sse_client

SERVERS = {
    "server-22": "https://scp.intern-ai.org.cn/api/v1/mcp/22/Thermal_Fluid_Dynamics"
}

async def connect(url, stack):
    transport = streamablehttp_client(url=url, headers={"SCP-HUB-API-KEY": "sk-b04409a1-b32b-4511-9aeb-22980abdc05c"})
    read, write, _ = await stack.enter_async_context(transport)
    ctx = ClientSession(read, write)
    session = await stack.enter_async_context(ctx)
    await session.initialize()
    return session

def parse(result):
    try:
        if hasattr(result, 'content') and result.content:
            c = result.content[0]
            if hasattr(c, 'text'):
                try: return json.loads(c.text)
                except: return c.text
        return str(result)
    except: return str(result)

async def main():
    async with AsyncExitStack() as stack:
        # Connect to required servers
        sessions = {}
        sessions["server-22"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/22/Thermal_Fluid_Dynamics", stack)

        # Execute workflow steps
        # Step 1: Calculate heat released
        result_1 = await sessions["server-22"].call_tool("calculate_heat_released", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Convert energy MeV to Joules
        result_2 = await sessions["server-22"].call_tool("convert_energy_MeV_to_J", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Calculate potential energy
        result_3 = await sessions["server-22"].call_tool("calculate_potential_energy", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Compute dynamic viscosity
        result_4 = await sessions["server-22"].call_tool("calculate_dynamic_viscosity", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
