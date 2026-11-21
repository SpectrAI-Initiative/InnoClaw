---
name: tissue_specific_analysis
description: "Tissue-Specific Expression Analysis - Analyze tissue-specific expression: ChEMBL tissue data, TCGA cancer expression, Ensembl gene info, and NCBI gene data. Use this skill for tissue biology tasks involving get tissue by id get gene expression across cancers get lookup symbol get gene metadata by gene name. Combines 4 tools from 4 SCP server(s)."
---

# Tissue-Specific Expression Analysis

**Discipline**: Tissue Biology | **Tools Used**: 4 | **Servers**: 4

## Description

Analyze tissue-specific expression: ChEMBL tissue data, TCGA cancer expression, Ensembl gene info, and NCBI gene data.

## Tools Used

- **`get_tissue_by_id`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`get_gene_expression_across_cancers`** from `tcga-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA`
- **`get_lookup_symbol`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_gene_metadata_by_gene_name`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`

## Workflow

1. Get ChEMBL tissue info
2. Get TCGA cancer expression
3. Get Ensembl gene info
4. Get NCBI gene metadata

## Test Case

### Input
```json
{
    "gene": "EGFR",
    "tissue_id": "CHEMBL3559723"
}
```

### Expected Steps
1. Get ChEMBL tissue info
2. Get TCGA cancer expression
3. Get Ensembl gene info
4. Get NCBI gene metadata

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
    "tcga-server": "https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA",
    "ensembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl",
    "ncbi-server": "https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI"
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
        sessions["tcga-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA", stack)
        sessions["ensembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl", stack)
        sessions["ncbi-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI", stack)

        # Execute workflow steps
        # Step 1: Get ChEMBL tissue info
        result_1 = await sessions["chembl-server"].call_tool("get_tissue_by_id", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get TCGA cancer expression
        result_2 = await sessions["tcga-server"].call_tool("get_gene_expression_across_cancers", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get Ensembl gene info
        result_3 = await sessions["ensembl-server"].call_tool("get_lookup_symbol", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get NCBI gene metadata
        result_4 = await sessions["ncbi-server"].call_tool("get_gene_metadata_by_gene_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
