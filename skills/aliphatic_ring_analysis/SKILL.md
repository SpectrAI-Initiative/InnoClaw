---
name: aliphatic_ring_analysis
description: "Ring System Analysis - Analyze ring systems: count aliphatic carbocycles, analyze aromaticity, compute topology, and structure complexity. Use this skill for organic chemistry tasks involving GetAliphaticCarbocyclesNum AromaticityAnalyzer calculate mol topology calculate mol structure complexity. Combines 4 tools from 3 SCP server(s)."
---

# Ring System Analysis

**Discipline**: Organic Chemistry | **Tools Used**: 4 | **Servers**: 3

## Description

Analyze ring systems: count aliphatic carbocycles, analyze aromaticity, compute topology, and structure complexity.

## Tools Used

- **`GetAliphaticCarbocyclesNum`** from `server-31` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/31/SciToolAgent-Chem`
- **`AromaticityAnalyzer`** from `server-28` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent`
- **`calculate_mol_topology`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_mol_structure_complexity`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`

## Workflow

1. Count aliphatic carbocycles
2. Analyze aromaticity
3. Calculate topological descriptors
4. Assess structural complexity

## Test Case

### Input
```json
{
    "smiles": "C1CCC(CC1)c1ccccc1"
}
```

### Expected Steps
1. Count aliphatic carbocycles
2. Analyze aromaticity
3. Calculate topological descriptors
4. Assess structural complexity

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
    "server-31": "https://scp.intern-ai.org.cn/api/v1/mcp/31/SciToolAgent-Chem",
    "server-28": "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent",
    "server-2": "https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool"
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
        sessions["server-31"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/31/SciToolAgent-Chem", stack)
        sessions["server-28"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent", stack)
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)

        # Execute workflow steps
        # Step 1: Count aliphatic carbocycles
        result_1 = await sessions["server-31"].call_tool("GetAliphaticCarbocyclesNum", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Analyze aromaticity
        result_2 = await sessions["server-28"].call_tool("AromaticityAnalyzer", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Calculate topological descriptors
        result_3 = await sessions["server-2"].call_tool("calculate_mol_topology", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Assess structural complexity
        result_4 = await sessions["server-2"].call_tool("calculate_mol_structure_complexity", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
