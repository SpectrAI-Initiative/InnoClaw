---
name: blast_protein_analysis
description: "BLAST & Protein Analysis Pipeline - BLAST search followed by comprehensive protein analysis: BLAST, then structure prediction, properties, and function. Use this skill for sequence bioinformatics tasks involving blast search pred protein structure esmfold calculate protein sequence properties predict protein function. Combines 4 tools from 4 SCP server(s)."
---

# BLAST & Protein Analysis Pipeline

**Discipline**: Sequence Bioinformatics | **Tools Used**: 4 | **Servers**: 4

## Description

BLAST search followed by comprehensive protein analysis: BLAST, then structure prediction, properties, and function.

## Tools Used

- **`blast_search`** from `server-17` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/17/BioInfo-Tools`
- **`pred_protein_structure_esmfold`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`
- **`calculate_protein_sequence_properties`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`predict_protein_function`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`

## Workflow

1. Run BLAST search
2. Predict structure for top hit
3. Calculate protein properties
4. Predict protein function

## Test Case

### Input
```json
{
    "sequence": "MKTIIALSYIFCLVFA"
}
```

### Expected Steps
1. Run BLAST search
2. Predict structure for top hit
3. Calculate protein properties
4. Predict protein function

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
    "server-17": "https://scp.intern-ai.org.cn/api/v1/mcp/17/BioInfo-Tools",
    "server-3": "https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model",
    "server-2": "https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool",
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
        sessions["server-17"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/17/BioInfo-Tools", stack)
        sessions["server-3"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model", stack)
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)
        sessions["server-1"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory", stack)

        # Execute workflow steps
        # Step 1: Run BLAST search
        result_1 = await sessions["server-17"].call_tool("blast_search", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Predict structure for top hit
        result_2 = await sessions["server-3"].call_tool("pred_protein_structure_esmfold", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Calculate protein properties
        result_3 = await sessions["server-2"].call_tool("calculate_protein_sequence_properties", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Predict protein function
        result_4 = await sessions["server-1"].call_tool("predict_protein_function", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
