---
name: molecular_visualization_suite
description: "Molecular Visualization Suite - Visualize molecules: convert SMILES to formats, visualize molecule, visualize protein, visualize complex. Use this skill for chemical visualization tasks involving convert smiles to format visualize molecule visualize protein visualize complex. Combines 4 tools from 1 SCP server(s)."
---

# Molecular Visualization Suite

**Discipline**: Chemical Visualization | **Tools Used**: 4 | **Servers**: 1

## Description

Visualize molecules: convert SMILES to formats, visualize molecule, visualize protein, visualize complex.

## Tools Used

- **`convert_smiles_to_format`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`visualize_molecule`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`visualize_protein`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`visualize_complex`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`

## Workflow

1. Convert SMILES to SDF
2. Visualize small molecule
3. Visualize protein
4. Visualize protein-ligand complex

## Test Case

### Input
```json
{
    "smiles": "CC(=O)Oc1ccccc1C(=O)O",
    "pdb_code": "1AKE"
}
```

### Expected Steps
1. Convert SMILES to SDF
2. Visualize small molecule
3. Visualize protein
4. Visualize protein-ligand complex

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
        # Step 1: Convert SMILES to SDF
        result_1 = await sessions["server-2"].call_tool("convert_smiles_to_format", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Visualize small molecule
        result_2 = await sessions["server-2"].call_tool("visualize_molecule", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Visualize protein
        result_3 = await sessions["server-2"].call_tool("visualize_protein", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Visualize protein-ligand complex
        result_4 = await sessions["server-2"].call_tool("visualize_complex", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
