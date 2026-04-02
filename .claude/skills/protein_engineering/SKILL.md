---
name: protein_engineering
description: "Protein Engineering Workflow - Engineer a protein: predict structure, identify functional residues, predict beneficial mutations, and calculate properties. Use this skill for protein engineering tasks involving Protein structure prediction ESMFold predict functional residue zero shot sequence prediction calculate protein sequence properties. Combines 4 tools from 2 SCP server(s)."
---

# Protein Engineering Workflow

**Discipline**: Protein Engineering | **Tools Used**: 4 | **Servers**: 2

## Description

Engineer a protein: predict structure, identify functional residues, predict beneficial mutations, and calculate properties.

## Tools Used

- **`Protein_structure_prediction_ESMFold`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`predict_functional_residue`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`zero_shot_sequence_prediction`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`calculate_protein_sequence_properties`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`

## Workflow

1. Predict 3D structure with ESMFold
2. Identify functional residues
3. Predict beneficial mutations
4. Calculate physicochemical properties

## Test Case

### Input
```json
{
    "sequence": "MKTIIALSYIFCLVFAGKRDEFPSTWYV"
}
```

### Expected Steps
1. Predict 3D structure with ESMFold
2. Identify functional residues
3. Predict beneficial mutations
4. Calculate physicochemical properties

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
    "server-1": "https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory",
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
        sessions["server-1"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory", stack)
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)

        # Execute workflow steps
        # Step 1: Predict 3D structure with ESMFold
        result_1 = await sessions["server-1"].call_tool("Protein_structure_prediction_ESMFold", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Identify functional residues
        result_2 = await sessions["server-1"].call_tool("predict_functional_residue", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Predict beneficial mutations
        result_3 = await sessions["server-1"].call_tool("zero_shot_sequence_prediction", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Calculate physicochemical properties
        result_4 = await sessions["server-2"].call_tool("calculate_protein_sequence_properties", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
