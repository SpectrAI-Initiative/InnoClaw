---
name: chemical_structure_comparison
description: "Chemical Structure Comparison - Compare chemical structures: get SMILES, analyze structures, compute similarity, and check PubChem records. Use this skill for cheminformatics tasks involving NameToSMILES ChemicalStructureAnalyzer calculate smiles similarity get compound by name. Combines 4 tools from 4 SCP server(s)."
---

# Chemical Structure Comparison

**Discipline**: Cheminformatics | **Tools Used**: 4 | **Servers**: 4

## Description

Compare chemical structures: get SMILES, analyze structures, compute similarity, and check PubChem records.

## Tools Used

- **`NameToSMILES`** from `server-31` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/31/SciToolAgent-Chem`
- **`ChemicalStructureAnalyzer`** from `server-28` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent`
- **`calculate_smiles_similarity`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`get_compound_by_name`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`

## Workflow

1. Convert names to SMILES
2. Analyze both structures
3. Compute similarity
4. Get PubChem compound data

## Test Case

### Input
```json
{
    "compound_a": "aspirin",
    "compound_b": "ibuprofen"
}
```

### Expected Steps
1. Convert names to SMILES
2. Analyze both structures
3. Compute similarity
4. Get PubChem compound data

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
    "server-31": "https://scp.intern-ai.org.cn/api/v1/mcp/31/SciToolAgent-Chem",
    "server-28": "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent",
    "server-2": "https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool",
    "pubchem-server": "https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem"
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
        sessions["server-31"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/31/SciToolAgent-Chem", stack)
        sessions["server-28"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent", stack)
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)
        sessions["pubchem-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem", stack)

        # Execute workflow steps
        # Step 1: Convert names to SMILES
        result_1 = await sessions["server-31"].call_tool("NameToSMILES", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Analyze both structures
        result_2 = await sessions["server-28"].call_tool("ChemicalStructureAnalyzer", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute similarity
        result_3 = await sessions["server-2"].call_tool("calculate_smiles_similarity", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get PubChem compound data
        result_4 = await sessions["pubchem-server"].call_tool("get_compound_by_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
