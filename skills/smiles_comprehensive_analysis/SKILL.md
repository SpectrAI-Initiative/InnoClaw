---
name: smiles_comprehensive_analysis
description: "SMILES Comprehensive Analysis - Comprehensive SMILES analysis: validate, convert name, compute all molecular descriptors, and predict ADMET. Use this skill for cheminformatics tasks involving is valid smiles ChemicalStructureAnalyzer calculate mol basic info pred molecule admet. Combines 4 tools from 3 SCP server(s)."
---

# SMILES Comprehensive Analysis

**Discipline**: Cheminformatics | **Tools Used**: 4 | **Servers**: 3

## Description

Comprehensive SMILES analysis: validate, convert name, compute all molecular descriptors, and predict ADMET.

## Tools Used

- **`is_valid_smiles`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`ChemicalStructureAnalyzer`** from `server-28` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent`
- **`calculate_mol_basic_info`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`pred_molecule_admet`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`

## Workflow

1. Validate SMILES
2. Analyze structure
3. Calculate molecular descriptors
4. Predict ADMET

## Test Case

### Input
```json
{
    "smiles": "CC(=O)Oc1ccccc1C(=O)O"
}
```

### Expected Steps
1. Validate SMILES
2. Analyze structure
3. Calculate molecular descriptors
4. Predict ADMET

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
    "server-28": "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent",
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
        sessions["server-28"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent", stack)
        sessions["server-3"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model", stack)

        # Execute workflow steps
        # Step 1: Validate SMILES
        result_1 = await sessions["server-2"].call_tool("is_valid_smiles", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Analyze structure
        result_2 = await sessions["server-28"].call_tool("ChemicalStructureAnalyzer", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Calculate molecular descriptors
        result_3 = await sessions["server-2"].call_tool("calculate_mol_basic_info", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Predict ADMET
        result_4 = await sessions["server-3"].call_tool("pred_molecule_admet", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
