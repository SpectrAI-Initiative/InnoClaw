---
name: protein_complex_analysis
description: "Protein Complex Visualization & Analysis - Analyze protein complex: download structure, visualize complex, extract chains, and calculate quality metrics. Use this skill for structural biology tasks involving retrieve protein data by pdbcode visualize complex extract pdb chains calculate pdb basic info. Combines 4 tools from 1 SCP server(s)."
---

# Protein Complex Visualization & Analysis

**Discipline**: Structural Biology | **Tools Used**: 4 | **Servers**: 1

## Description

Analyze protein complex: download structure, visualize complex, extract chains, and calculate quality metrics.

## Tools Used

- **`retrieve_protein_data_by_pdbcode`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`visualize_complex`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`extract_pdb_chains`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_pdb_basic_info`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`

## Workflow

1. Download complex structure
2. Visualize protein-ligand complex
3. Extract individual chains
4. Calculate structural statistics

## Test Case

### Input
```json
{
    "pdb_code": "6LU7"
}
```

### Expected Steps
1. Download complex structure
2. Visualize protein-ligand complex
3. Extract individual chains
4. Calculate structural statistics

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
        # Step 1: Download complex structure
        result_1 = await sessions["server-2"].call_tool("retrieve_protein_data_by_pdbcode", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Visualize protein-ligand complex
        result_2 = await sessions["server-2"].call_tool("visualize_complex", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Extract individual chains
        result_3 = await sessions["server-2"].call_tool("extract_pdb_chains", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Calculate structural statistics
        result_4 = await sessions["server-2"].call_tool("calculate_pdb_basic_info", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
