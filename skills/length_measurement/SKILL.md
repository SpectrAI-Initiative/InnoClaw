---
name: length_measurement
description: "Length & Dimension Measurement - Precision length measurement: convert mm to m, calculate length plus width, area, and error. Use this skill for metrology tasks involving convert length mm to m calculate length plus width calculate area calculate absolute error. Combines 4 tools from 3 SCP server(s)."
---

# Length & Dimension Measurement

**Discipline**: Metrology | **Tools Used**: 4 | **Servers**: 3

## Description

Precision length measurement: convert mm to m, calculate length plus width, area, and error.

## Tools Used

- **`convert_length_mm_to_m`** from `server-27` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/27/Physical_Quantities_Conversion`
- **`calculate_length_plus_width`** from `server-25` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations`
- **`calculate_area`** from `server-25` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations`
- **`calculate_absolute_error`** from `server-26` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis`

## Workflow

1. Convert length mm to m
2. Calculate length plus width
3. Calculate area
4. Compute measurement error

## Test Case

### Input
```json
{
    "length_mm": 150,
    "width_mm": 80
}
```

### Expected Steps
1. Convert length mm to m
2. Calculate length plus width
3. Calculate area
4. Compute measurement error

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
    "server-27": "https://scp.intern-ai.org.cn/api/v1/mcp/27/Physical_Quantities_Conversion",
    "server-25": "https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations",
    "server-26": "https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis"
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
        sessions["server-25"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations", stack)
        sessions["server-26"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis", stack)

        # Execute workflow steps
        # Step 1: Convert length mm to m
        result_1 = await sessions["server-27"].call_tool("convert_length_mm_to_m", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Calculate length plus width
        result_2 = await sessions["server-25"].call_tool("calculate_length_plus_width", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Calculate area
        result_3 = await sessions["server-25"].call_tool("calculate_area", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Compute measurement error
        result_4 = await sessions["server-26"].call_tool("calculate_absolute_error", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
