---
name: unit_conversion_suite
description: "Multi-Unit Conversion Suite - Convert units across domains: length mm to m, radius m to cm, dimensions to meters, nm to um, volume to cm3. Use this skill for metrology tasks involving convert length mm to m convert radius m to cm convert dimensions to meters convert nm to um convert volume to cm3. Combines 5 tools from 1 SCP server(s)."
---

# Multi-Unit Conversion Suite

**Discipline**: Metrology | **Tools Used**: 5 | **Servers**: 1

## Description

Convert units across domains: length mm to m, radius m to cm, dimensions to meters, nm to um, volume to cm3.

## Tools Used

- **`convert_length_mm_to_m`** from `server-27` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/27/Physical_Quantities_Conversion`
- **`convert_radius_m_to_cm`** from `server-27` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/27/Physical_Quantities_Conversion`
- **`convert_dimensions_to_meters`** from `server-27` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/27/Physical_Quantities_Conversion`
- **`convert_nm_to_um`** from `server-27` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/27/Physical_Quantities_Conversion`
- **`convert_volume_to_cm3`** from `server-27` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/27/Physical_Quantities_Conversion`

## Workflow

1. Convert mm to m
2. Convert radius m to cm
3. Convert dimensions to meters
4. Convert nm to um
5. Convert volume to cm3

## Test Case

### Input
```json
{
    "length_mm": 100,
    "radius_m": 0.5,
    "nm_val": 500
}
```

### Expected Steps
1. Convert mm to m
2. Convert radius m to cm
3. Convert dimensions to meters
4. Convert nm to um
5. Convert volume to cm3

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
    "server-27": "https://scp.intern-ai.org.cn/api/v1/mcp/27/Physical_Quantities_Conversion"
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
        sessions["server-27"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/27/Physical_Quantities_Conversion", stack)

        # Execute workflow steps
        # Step 1: Convert mm to m
        result_1 = await sessions["server-27"].call_tool("convert_length_mm_to_m", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Convert radius m to cm
        result_2 = await sessions["server-27"].call_tool("convert_radius_m_to_cm", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Convert dimensions to meters
        result_3 = await sessions["server-27"].call_tool("convert_dimensions_to_meters", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Convert nm to um
        result_4 = await sessions["server-27"].call_tool("convert_nm_to_um", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Step 5: Convert volume to cm3
        result_5 = await sessions["server-27"].call_tool("convert_volume_to_cm3", arguments={})
        data_5 = parse(result_5)
        print(f"Step 5 result: {json.dumps(data_5, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
