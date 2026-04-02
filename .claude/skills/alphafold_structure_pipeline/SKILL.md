---
name: alphafold_structure_pipeline
description: "AlphaFold Structure Analysis Pipeline - AlphaFold pipeline: download predicted structure, predict pockets, extract sequence, and compute properties. Use this skill for computational biology tasks involving download alphafold structure run fpocket extract pdb sequence calculate pdb basic info. Combines 4 tools from 3 SCP server(s)."
---

# AlphaFold Structure Analysis Pipeline

**Discipline**: Computational Biology | **Tools Used**: 4 | **Servers**: 3

## Description

AlphaFold pipeline: download predicted structure, predict pockets, extract sequence, and compute properties.

## Tools Used

- **`download_alphafold_structure`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`run_fpocket`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`
- **`extract_pdb_sequence`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`calculate_pdb_basic_info`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`

## Workflow

1. Download AlphaFold structure
2. Predict binding pockets
3. Extract protein sequence
4. Calculate structure statistics

## Test Case

### Input
```json
{
    "uniprot_id": "P04637"
}
```

### Expected Steps
1. Download AlphaFold structure
2. Predict binding pockets
3. Extract protein sequence
4. Calculate structure statistics

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
    "server-2": "https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool",
    "server-3": "https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model",
    "server-1": "https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory"
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
        sessions["server-3"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model", stack)
        sessions["server-1"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory", stack)

        # Execute workflow steps
        # Step 1: Download AlphaFold structure
        result_1 = await sessions["server-2"].call_tool("download_alphafold_structure", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Predict binding pockets
        result_2 = await sessions["server-3"].call_tool("run_fpocket", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Extract protein sequence
        result_3 = await sessions["server-1"].call_tool("extract_pdb_sequence", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Calculate structure statistics
        result_4 = await sessions["server-2"].call_tool("calculate_pdb_basic_info", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
