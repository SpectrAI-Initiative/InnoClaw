---
name: geometry_trigonometry
description: "Geometry & Trigonometry Suite - Solve geometry problems: calculate area, height from sine, angle in degrees, and increase factor. Use this skill for mathematics tasks involving calculate area calculate height from length and sine calculate phi deg calculate increase factor. Combines 4 tools from 1 SCP server(s)."
---

# Geometry & Trigonometry Suite

**Discipline**: Mathematics | **Tools Used**: 4 | **Servers**: 1

## Description

Solve geometry problems: calculate area, height from sine, angle in degrees, and increase factor.

## Tools Used

- **`calculate_area`** from `server-25` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations`
- **`calculate_height_from_length_and_sine`** from `server-25` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations`
- **`calculate_phi_deg`** from `server-25` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations`
- **`calculate_increase_factor`** from `server-25` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations`

## Workflow

1. Calculate area
2. Calculate height from sine
3. Convert angle to degrees
4. Calculate increase factor

## Test Case

### Input
```json
{
    "length": 10,
    "width": 5,
    "angle": 30
}
```

### Expected Steps
1. Calculate area
2. Calculate height from sine
3. Convert angle to degrees
4. Calculate increase factor

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
    "server-25": "https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations"
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
        sessions["server-25"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/25/Geometry_and_mathematical_calculations", stack)

        # Execute workflow steps
        # Step 1: Calculate area
        result_1 = await sessions["server-25"].call_tool("calculate_area", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Calculate height from sine
        result_2 = await sessions["server-25"].call_tool("calculate_height_from_length_and_sine", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Convert angle to degrees
        result_3 = await sessions["server-25"].call_tool("calculate_phi_deg", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Calculate increase factor
        result_4 = await sessions["server-25"].call_tool("calculate_increase_factor", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
