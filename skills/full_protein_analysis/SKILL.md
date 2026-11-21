---
name: full_protein_analysis
description: "Full Protein Characterization - Complete protein characterization: validate sequence, compute all properties, predict structure, and analyze pockets. Use this skill for protein biochemistry tasks involving is valid protein sequence analyze protein ComputeProtPara pred protein structure esmfold run fpocket. Combines 5 tools from 4 SCP server(s)."
---

# Full Protein Characterization

**Discipline**: Protein Biochemistry | **Tools Used**: 5 | **Servers**: 4

## Description

Complete protein characterization: validate sequence, compute all properties, predict structure, and analyze pockets.

## Tools Used

- **`is_valid_protein_sequence`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`analyze_protein`** from `server-17` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/17/BioInfo-Tools`
- **`ComputeProtPara`** from `server-29` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio`
- **`pred_protein_structure_esmfold`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`
- **`run_fpocket`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`

## Workflow

1. Validate sequence
2. Analyze protein features
3. Compute protein parameters
4. Predict 3D structure
5. Predict binding pockets

## Test Case

### Input
```json
{
    "sequence": "MKTIIALSYIFCLVFAGKRDEFPSTWYV"
}
```

### Expected Steps
1. Validate sequence
2. Analyze protein features
3. Compute protein parameters
4. Predict 3D structure
5. Predict binding pockets

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
    "server-17": "https://scp.intern-ai.org.cn/api/v1/mcp/17/BioInfo-Tools",
    "server-29": "https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio",
    "server-3": "https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model"
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
        sessions["server-17"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/17/BioInfo-Tools", stack)
        sessions["server-29"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio", stack)
        sessions["server-3"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model", stack)

        # Execute workflow steps
        # Step 1: Validate sequence
        result_1 = await sessions["server-2"].call_tool("is_valid_protein_sequence", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Analyze protein features
        result_2 = await sessions["server-17"].call_tool("analyze_protein", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute protein parameters
        result_3 = await sessions["server-29"].call_tool("ComputeProtPara", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Predict 3D structure
        result_4 = await sessions["server-3"].call_tool("pred_protein_structure_esmfold", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Step 5: Predict binding pockets
        result_5 = await sessions["server-3"].call_tool("run_fpocket", arguments={})
        data_5 = parse(result_5)
        print(f"Step 5 result: {json.dumps(data_5, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
