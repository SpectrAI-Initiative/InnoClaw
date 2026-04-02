---
name: electromagnetic_analysis
description: "Electromagnetic Field Analysis - Analyze EM fields: vacuum permittivity, total charge, radiation pressure, and photon calculations. Use this skill for electromagnetics tasks involving calculate vacuum permittivity calculate total charge calculate radiation pressure calculate total power. Combines 4 tools from 2 SCP server(s)."
---

# Electromagnetic Field Analysis

**Discipline**: Electromagnetics | **Tools Used**: 4 | **Servers**: 2

## Description

Analyze EM fields: vacuum permittivity, total charge, radiation pressure, and photon calculations.

## Tools Used

- **`calculate_vacuum_permittivity`** from `server-21` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/21/Electrical_Engineering_and_Circuit_Calculations`
- **`calculate_total_charge`** from `server-21` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/21/Electrical_Engineering_and_Circuit_Calculations`
- **`calculate_radiation_pressure`** from `server-23` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics`
- **`calculate_total_power`** from `server-23` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics`

## Workflow

1. Calculate vacuum permittivity
2. Sum total charge
3. Calculate radiation pressure
4. Calculate total power

## Test Case

### Input
```json
{
    "charge_values": [
        1e-06,
        2e-06
    ],
    "wavelength": 5e-07
}
```

### Expected Steps
1. Calculate vacuum permittivity
2. Sum total charge
3. Calculate radiation pressure
4. Calculate total power

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
    "server-21": "https://scp.intern-ai.org.cn/api/v1/mcp/21/Electrical_Engineering_and_Circuit_Calculations",
    "server-23": "https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics"
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
        sessions["server-21"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/21/Electrical_Engineering_and_Circuit_Calculations", stack)
        sessions["server-23"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics", stack)

        # Execute workflow steps
        # Step 1: Calculate vacuum permittivity
        result_1 = await sessions["server-21"].call_tool("calculate_vacuum_permittivity", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Sum total charge
        result_2 = await sessions["server-21"].call_tool("calculate_total_charge", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Calculate radiation pressure
        result_3 = await sessions["server-23"].call_tool("calculate_radiation_pressure", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Calculate total power
        result_4 = await sessions["server-23"].call_tool("calculate_total_power", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
