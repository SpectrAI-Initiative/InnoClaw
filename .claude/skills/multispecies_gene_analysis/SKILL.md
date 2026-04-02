---
name: multispecies_gene_analysis
description: "Multi-Species Gene Analysis - Analyze gene across species: Ensembl homologs, NCBI orthologs, cross-species STRING similarity, and taxonomy. Use this skill for comparative genomics tasks involving get homology symbol get gene orthologs get best similarity hits between species get taxonomy. Combines 4 tools from 3 SCP server(s)."
---

# Multi-Species Gene Analysis

**Discipline**: Comparative Genomics | **Tools Used**: 4 | **Servers**: 3

## Description

Analyze gene across species: Ensembl homologs, NCBI orthologs, cross-species STRING similarity, and taxonomy.

## Tools Used

- **`get_homology_symbol`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_gene_orthologs`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`
- **`get_best_similarity_hits_between_species`** from `string-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING`
- **`get_taxonomy`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`

## Workflow

1. Get Ensembl homologs
2. Get NCBI orthologs
3. Get STRING cross-species similarity
4. Get taxonomy for comparison

## Test Case

### Input
```json
{
    "gene": "TP53",
    "species": "homo_sapiens",
    "gene_id": 7157
}
```

### Expected Steps
1. Get Ensembl homologs
2. Get NCBI orthologs
3. Get STRING cross-species similarity
4. Get taxonomy for comparison

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
    "ensembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl",
    "ncbi-server": "https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI",
    "string-server": "https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING"
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
        sessions["ncbi-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI", stack)
        sessions["string-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING", stack)

        # Execute workflow steps
        # Step 1: Get Ensembl homologs
        result_1 = await sessions["ensembl-server"].call_tool("get_homology_symbol", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get NCBI orthologs
        result_2 = await sessions["ncbi-server"].call_tool("get_gene_orthologs", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get STRING cross-species similarity
        result_3 = await sessions["string-server"].call_tool("get_best_similarity_hits_between_species", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get taxonomy for comparison
        result_4 = await sessions["ncbi-server"].call_tool("get_taxonomy", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
