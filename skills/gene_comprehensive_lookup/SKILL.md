---
name: gene_comprehensive_lookup
description: "Gene Comprehensive Lookup - Comprehensive gene lookup: NCBI gene data, Ensembl gene info, UniProt protein data, and KEGG pathway links. Use this skill for bioinformatics tasks involving get gene metadata by gene name get lookup symbol get general info by protein or gene name kegg find. Combines 4 tools from 4 SCP server(s)."
---

# Gene Comprehensive Lookup

**Discipline**: Bioinformatics | **Tools Used**: 4 | **Servers**: 4

## Description

Comprehensive gene lookup: NCBI gene data, Ensembl gene info, UniProt protein data, and KEGG pathway links.

## Tools Used

- **`get_gene_metadata_by_gene_name`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`
- **`get_lookup_symbol`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_general_info_by_protein_or_gene_name`** from `uniprot-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt`
- **`kegg_find`** from `kegg-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG`

## Workflow

1. Get NCBI gene metadata
2. Look up in Ensembl
3. Get UniProt protein info
4. Find in KEGG

## Test Case

### Input
```json
{
    "gene_name": "BRCA1",
    "species": "homo_sapiens"
}
```

### Expected Steps
1. Get NCBI gene metadata
2. Look up in Ensembl
3. Get UniProt protein info
4. Find in KEGG

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
    "ncbi-server": "https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI",
    "ensembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl",
    "uniprot-server": "https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt",
    "kegg-server": "https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG"
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
        sessions["ncbi-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI", stack)
        sessions["ensembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl", stack)
        sessions["uniprot-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt", stack)
        sessions["kegg-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG", stack)

        # Execute workflow steps
        # Step 1: Get NCBI gene metadata
        result_1 = await sessions["ncbi-server"].call_tool("get_gene_metadata_by_gene_name", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Look up in Ensembl
        result_2 = await sessions["ensembl-server"].call_tool("get_lookup_symbol", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get UniProt protein info
        result_3 = await sessions["uniprot-server"].call_tool("get_general_info_by_protein_or_gene_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Find in KEGG
        result_4 = await sessions["kegg-server"].call_tool("kegg_find", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
