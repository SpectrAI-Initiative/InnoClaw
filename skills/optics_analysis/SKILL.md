---
name: optics_analysis
description: "Optical System Analysis - Analyze optical system: calculate photon rate, frequency range, radiation pressure, and electron wavelength. Use this skill for optics tasks involving calculate incident photon rate calculate frequency range calculate radiation pressure electron wavelength. Combines 4 tools from 1 SCP server(s)."
---

# Optical System Analysis

**Discipline**: Optics | **Tools Used**: 4 | **Servers**: 1

## Description

Analyze optical system: calculate photon rate, frequency range, radiation pressure, and electron wavelength.

## Tools Used

- **`calculate_incident_photon_rate`** from `server-23` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics`
- **`calculate_frequency_range`** from `server-23` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics`
- **`calculate_radiation_pressure`** from `server-23` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics`
- **`electron_wavelength`** from `server-23` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics`

## Workflow

1. Calculate incident photon rate
2. Calculate frequency range
3. Compute radiation pressure
4. Calculate electron wavelength

## Test Case

### Input
```json
{
    "wavelength": 5e-07,
    "power": 1.0
}
```

### Expected Steps
1. Calculate incident photon rate
2. Calculate frequency range
3. Compute radiation pressure
4. Calculate electron wavelength

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
        sessions["server-23"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics", stack)

        # Execute workflow steps
        # Step 1: Calculate incident photon rate
        result_1 = await sessions["server-23"].call_tool("calculate_incident_photon_rate", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Calculate frequency range
        result_2 = await sessions["server-23"].call_tool("calculate_frequency_range", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute radiation pressure
        result_3 = await sessions["server-23"].call_tool("calculate_radiation_pressure", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Calculate electron wavelength
        result_4 = await sessions["server-23"].call_tool("electron_wavelength", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
