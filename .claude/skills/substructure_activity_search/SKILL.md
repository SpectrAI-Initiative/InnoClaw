---
name: substructure_activity_search
description: "Substructure-Activity Relationship - Analyze substructure-activity: ChEMBL substructure search, activity data, PubChem compounds, and similarity. Use this skill for medicinal chemistry tasks involving get substructure by smiles search activity search pubchem by smiles calculate smiles similarity. Combines 4 tools from 3 SCP server(s)."
---

# Substructure-Activity Relationship

**Discipline**: Medicinal Chemistry | **Tools Used**: 4 | **Servers**: 3

## Description

Analyze substructure-activity: ChEMBL substructure search, activity data, PubChem compounds, and similarity.

## Tools Used

- **`get_substructure_by_smiles`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`search_activity`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`search_pubchem_by_smiles`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`
- **`calculate_smiles_similarity`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`

## Workflow

1. Search ChEMBL by substructure
2. Get bioactivity data for hits
3. Search PubChem for related compounds
4. Compute similarity matrix

## Test Case

### Input
```json
{
    "smiles": "c1ccc2[nH]ccc2c1"
}
```

### Expected Steps
1. Search ChEMBL by substructure
2. Get bioactivity data for hits
3. Search PubChem for related compounds
4. Compute similarity matrix

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
    "chembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL",
    "pubchem-server": "https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem",
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
        sessions["chembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL", stack)
        sessions["pubchem-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem", stack)
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)

        # Execute workflow steps
        # Step 1: Search ChEMBL by substructure
        result_1 = await sessions["chembl-server"].call_tool("get_substructure_by_smiles", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get bioactivity data for hits
        result_2 = await sessions["chembl-server"].call_tool("search_activity", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Search PubChem for related compounds
        result_3 = await sessions["pubchem-server"].call_tool("search_pubchem_by_smiles", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Compute similarity matrix
        result_4 = await sessions["server-2"].call_tool("calculate_smiles_similarity", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
