---
name: protein_quality_assessment
description: "Protein Structure Quality Assessment - Assess structure quality: basic info, geometry analysis, quality metrics, composition, and visualization. Use this skill for structural biology tasks involving calculate pdb basic info calculate pdb structural geometry calculate pdb quality metrics calculate pdb composition info visualize protein. Combines 5 tools from 1 SCP server(s)."
---

# Protein Structure Quality Assessment

**Discipline**: Structural Biology | **Tools Used**: 5 | **Servers**: 1

## Description

Assess structure quality: basic info, geometry analysis, quality metrics, composition, and visualization.

## Tools Used

- **`calculate_pdb_basic_info`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_pdb_structural_geometry`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_pdb_quality_metrics`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_pdb_composition_info`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`visualize_protein`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`

## Workflow

1. Calculate basic structure info
2. Analyze structural geometry
3. Compute quality metrics
4. Analyze composition
5. Visualize structure

## Test Case

### Input
```json
{
    "pdb_code": "1AKE"
}
```

### Expected Steps
1. Calculate basic structure info
2. Analyze structural geometry
3. Compute quality metrics
4. Analyze composition
5. Visualize structure

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
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)

        # Execute workflow steps
        # Step 1: Calculate basic structure info
        result_1 = await sessions["server-2"].call_tool("calculate_pdb_basic_info", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Analyze structural geometry
        result_2 = await sessions["server-2"].call_tool("calculate_pdb_structural_geometry", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute quality metrics
        result_3 = await sessions["server-2"].call_tool("calculate_pdb_quality_metrics", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Analyze composition
        result_4 = await sessions["server-2"].call_tool("calculate_pdb_composition_info", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Step 5: Visualize structure
        result_5 = await sessions["server-2"].call_tool("visualize_protein", arguments={})
        data_5 = parse(result_5)
        print(f"Step 5 result: {json.dumps(data_5, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
