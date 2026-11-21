---
name: mutation_impact_analysis
description: "Mutation Impact Analysis - Analyze mutation impact: predict structure, predict mutations from sequence and structure, and check variant effects with Ensembl VEP. Use this skill for molecular biology tasks involving pred protein structure esmfold zero shot sequence prediction predict zero shot structure get vep hgvs. Combines 4 tools from 3 SCP server(s)."
---

# Mutation Impact Analysis

**Discipline**: Molecular Biology | **Tools Used**: 4 | **Servers**: 3

## Description

Analyze mutation impact: predict structure, predict mutations from sequence and structure, and check variant effects with Ensembl VEP.

## Tools Used

- **`pred_protein_structure_esmfold`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`
- **`zero_shot_sequence_prediction`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`predict_zero_shot_structure`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`get_vep_hgvs`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`

## Workflow

1. Predict protein structure
2. Predict mutations from sequence
3. Predict mutations from structure
4. Check variant effects with VEP

## Test Case

### Input
```json
{
    "sequence": "MKTIIALSYIFCLVFA",
    "hgvs": "ENSP00000269305.4:p.Val600Glu"
}
```

### Expected Steps
1. Predict protein structure
2. Predict mutations from sequence
3. Predict mutations from structure
4. Check variant effects with VEP

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
    "server-3": "https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model",
    "server-1": "https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory",
    "ensembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl"
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
        sessions["server-3"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model", stack)
        sessions["server-1"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory", stack)
        sessions["ensembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl", stack)

        # Execute workflow steps
        # Step 1: Predict protein structure
        result_1 = await sessions["server-3"].call_tool("pred_protein_structure_esmfold", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Predict mutations from sequence
        result_2 = await sessions["server-1"].call_tool("zero_shot_sequence_prediction", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Predict mutations from structure
        result_3 = await sessions["server-1"].call_tool("predict_zero_shot_structure", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Check variant effects with VEP
        result_4 = await sessions["ensembl-server"].call_tool("get_vep_hgvs", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
