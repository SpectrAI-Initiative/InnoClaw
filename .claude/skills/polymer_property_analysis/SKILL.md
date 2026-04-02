---
name: polymer_property_analysis
description: "Polymer & Material Property Analysis - Analyze polymer properties: composition, symmetry, density, and lattice parameters for material design. Use this skill for polymer science tasks involving MaterialCompositionAnalyzer CalculateSymmetry CalculateDensity MofLattice. Combines 4 tools from 2 SCP server(s)."
---

# Polymer & Material Property Analysis

**Discipline**: Polymer Science | **Tools Used**: 4 | **Servers**: 2

## Description

Analyze polymer properties: composition, symmetry, density, and lattice parameters for material design.

## Tools Used

- **`MaterialCompositionAnalyzer`** from `server-28` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent`
- **`CalculateSymmetry`** from `server-30` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/30/SciToolAgent-Mat`
- **`CalculateDensity`** from `server-30` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/30/SciToolAgent-Mat`
- **`MofLattice`** from `server-30` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/30/SciToolAgent-Mat`

## Workflow

1. Analyze material composition
2. Calculate symmetry group
3. Calculate density
4. Get lattice parameters

## Test Case

### Input
```json
{
    "material_data": "example_material"
}
```

### Expected Steps
1. Analyze material composition
2. Calculate symmetry group
3. Calculate density
4. Get lattice parameters

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
    "server-28": "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent",
    "server-30": "https://scp.intern-ai.org.cn/api/v1/mcp/30/SciToolAgent-Mat"
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
        sessions["server-28"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent", stack)
        sessions["server-30"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/30/SciToolAgent-Mat", stack)

        # Execute workflow steps
        # Step 1: Analyze material composition
        result_1 = await sessions["server-28"].call_tool("MaterialCompositionAnalyzer", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Calculate symmetry group
        result_2 = await sessions["server-30"].call_tool("CalculateSymmetry", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Calculate density
        result_3 = await sessions["server-30"].call_tool("CalculateDensity", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get lattice parameters
        result_4 = await sessions["server-30"].call_tool("MofLattice", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
