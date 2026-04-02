---
name: virtual_screening
description: "Virtual Screening Pipeline - Virtual screening: search PubChem by substructure, compute similarity, filter by drug-likeness, and predict binding affinity. Use this skill for drug discovery tasks involving search pubchem by smiles calculate smiles similarity calculate mol drug chemistry boltz binding affinity. Combines 4 tools from 3 SCP server(s)."
---

# Virtual Screening Pipeline

**Discipline**: Drug Discovery | **Tools Used**: 4 | **Servers**: 3

## Description

Virtual screening: search PubChem by substructure, compute similarity, filter by drug-likeness, and predict binding affinity.

## Tools Used

- **`search_pubchem_by_smiles`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`
- **`calculate_smiles_similarity`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_mol_drug_chemistry`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`boltz_binding_affinity`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`

## Workflow

1. Search similar compounds in PubChem
2. Compute molecular similarity
3. Filter by drug-likeness
4. Predict binding affinity

## Test Case

### Input
```json
{
    "query_smiles": "c1ccc(-c2ccccc2)cc1",
    "target_protein": "MKTIIALSYIFCLVFA"
}
```

### Expected Steps
1. Search similar compounds in PubChem
2. Compute molecular similarity
3. Filter by drug-likeness
4. Predict binding affinity

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
    "pubchem-server": "https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem",
    "server-2": "https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool",
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
        sessions["pubchem-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem", stack)
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)
        sessions["server-3"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model", stack)

        # Execute workflow steps
        # Step 1: Search similar compounds in PubChem
        result_1 = await sessions["pubchem-server"].call_tool("search_pubchem_by_smiles", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Compute molecular similarity
        result_2 = await sessions["server-2"].call_tool("calculate_smiles_similarity", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Filter by drug-likeness
        result_3 = await sessions["server-2"].call_tool("calculate_mol_drug_chemistry", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Predict binding affinity
        result_4 = await sessions["server-3"].call_tool("boltz_binding_affinity", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
