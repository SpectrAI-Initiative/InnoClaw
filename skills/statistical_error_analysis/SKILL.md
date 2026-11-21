---
name: statistical_error_analysis
description: "Statistical Error Analysis - Analyze measurement errors: absolute error, scientific notation, max value, mean square, and formatting. Use this skill for statistics tasks involving calculate absolute error convert to scientific notation calculate max value calculate mean square format scientific notation. Combines 5 tools from 1 SCP server(s)."
---

# Statistical Error Analysis

**Discipline**: Statistics | **Tools Used**: 5 | **Servers**: 1

## Description

Analyze measurement errors: absolute error, scientific notation, max value, mean square, and formatting.

## Tools Used

- **`calculate_absolute_error`** from `server-26` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis`
- **`convert_to_scientific_notation`** from `server-26` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis`
- **`calculate_max_value`** from `server-26` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis`
- **`calculate_mean_square`** from `server-26` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis`
- **`format_scientific_notation`** from `server-26` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis`

## Workflow

1. Calculate absolute error
2. Convert to scientific notation
3. Find maximum value
4. Calculate mean square
5. Format results in scientific notation

## Test Case

### Input
```json
{
    "measured": 14.7,
    "true_val": 15.0,
    "values": [
        14.5,
        14.7,
        14.9,
        15.1
    ]
}
```

### Expected Steps
1. Calculate absolute error
2. Convert to scientific notation
3. Find maximum value
4. Calculate mean square
5. Format results in scientific notation

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
        sessions["server-26"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis", stack)

        # Execute workflow steps
        # Step 1: Calculate absolute error
        result_1 = await sessions["server-26"].call_tool("calculate_absolute_error", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Convert to scientific notation
        result_2 = await sessions["server-26"].call_tool("convert_to_scientific_notation", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Find maximum value
        result_3 = await sessions["server-26"].call_tool("calculate_max_value", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Calculate mean square
        result_4 = await sessions["server-26"].call_tool("calculate_mean_square", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Step 5: Format results in scientific notation
        result_5 = await sessions["server-26"].call_tool("format_scientific_notation", arguments={})
        data_5 = parse(result_5)
        print(f"Step 5 result: {json.dumps(data_5, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
