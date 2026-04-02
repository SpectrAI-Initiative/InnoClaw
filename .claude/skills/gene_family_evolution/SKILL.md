---
name: gene_family_evolution
description: "Gene Family Evolution Analysis - Analyze gene family evolution: CAFE gene tree, homology, Ensembl gene tree, and taxonomy. Use this skill for molecular evolution tasks involving get cafe genetree member symbol get homology symbol get genetree member symbol get taxonomy classification. Combines 4 tools from 1 SCP server(s)."
---

# Gene Family Evolution Analysis

**Discipline**: Molecular Evolution | **Tools Used**: 4 | **Servers**: 1

## Description

Analyze gene family evolution: CAFE gene tree, homology, Ensembl gene tree, and taxonomy.

## Tools Used

- **`get_cafe_genetree_member_symbol`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_homology_symbol`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_genetree_member_symbol`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_taxonomy_classification`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`

## Workflow

1. Get CAFE gene family evolution tree
2. Find homologs across species
3. Get full gene tree
4. Get taxonomic classification

## Test Case

### Input
```json
{
    "gene": "TP53",
    "species": "homo_sapiens"
}
```

### Expected Steps
1. Get CAFE gene family evolution tree
2. Find homologs across species
3. Get full gene tree
4. Get taxonomic classification

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
        sessions["ensembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl", stack)

        # Execute workflow steps
        # Step 1: Get CAFE gene family evolution tree
        result_1 = await sessions["ensembl-server"].call_tool("get_cafe_genetree_member_symbol", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Find homologs across species
        result_2 = await sessions["ensembl-server"].call_tool("get_homology_symbol", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get full gene tree
        result_3 = await sessions["ensembl-server"].call_tool("get_genetree_member_symbol", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get taxonomic classification
        result_4 = await sessions["ensembl-server"].call_tool("get_taxonomy_classification", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
