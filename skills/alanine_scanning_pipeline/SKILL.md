---
name: alanine_scanning_pipeline
description: "Alanine Scanning Mutagenesis Pipeline - Alanine scanning: design scan, compute properties for each mutant, predict interactions, and compare. Use this skill for protein biochemistry tasks involving AlanineScanningDesigner ComputeProtPara PredictDrugTargetInteraction calculate protein sequence properties. Combines 4 tools from 3 SCP server(s)."
---

# Alanine Scanning Mutagenesis Pipeline

**Discipline**: Protein Biochemistry | **Tools Used**: 4 | **Servers**: 3

## Description

Alanine scanning: design scan, compute properties for each mutant, predict interactions, and compare.

## Tools Used

- **`AlanineScanningDesigner`** from `server-28` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent`
- **`ComputeProtPara`** from `server-29` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio`
- **`PredictDrugTargetInteraction`** from `server-29` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio`
- **`calculate_protein_sequence_properties`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`

## Workflow

1. Design alanine scan mutants
2. Compute parameters for mutants
3. Predict interactions for mutants
4. Compare protein properties

## Test Case

### Input
```json
{
    "sequence": "MKTIIALSYIFCLVFA"
}
```

### Expected Steps
1. Design alanine scan mutants
2. Compute parameters for mutants
3. Predict interactions for mutants
4. Compare protein properties

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
    "server-29": "https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio",
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
        sessions["server-28"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent", stack)
        sessions["server-29"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio", stack)
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)

        # Execute workflow steps
        # Step 1: Design alanine scan mutants
        result_1 = await sessions["server-28"].call_tool("AlanineScanningDesigner", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Compute parameters for mutants
        result_2 = await sessions["server-29"].call_tool("ComputeProtPara", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Predict interactions for mutants
        result_3 = await sessions["server-29"].call_tool("PredictDrugTargetInteraction", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Compare protein properties
        result_4 = await sessions["server-2"].call_tool("calculate_protein_sequence_properties", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
