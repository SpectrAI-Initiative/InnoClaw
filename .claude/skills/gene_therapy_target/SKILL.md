---
name: gene_therapy_target
description: "Gene Therapy Target Analysis - Analyze gene therapy target: gene info, variant pathogenicity, protein structure, and clinical evidence. Use this skill for gene therapy tasks involving get gene metadata by gene name get vep hgvs Protein structure prediction ESMFold clinvar search. Combines 4 tools from 4 SCP server(s)."
---

# Gene Therapy Target Analysis

**Discipline**: Gene Therapy | **Tools Used**: 4 | **Servers**: 4

## Description

Analyze gene therapy target: gene info, variant pathogenicity, protein structure, and clinical evidence.

## Tools Used

- **`get_gene_metadata_by_gene_name`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`
- **`get_vep_hgvs`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`Protein_structure_prediction_ESMFold`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`clinvar_search`** from `search-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search`

## Workflow

1. Get gene info
2. Predict variant effect
3. Predict protein structure
4. Search ClinVar pathogenicity

## Test Case

### Input
```json
{
    "gene": "CFTR",
    "hgvs": "ENSP00000003084.6:p.Phe508del"
}
```

### Expected Steps
1. Get gene info
2. Predict variant effect
3. Predict protein structure
4. Search ClinVar pathogenicity

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
    "server-1": "https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory",
    "search-server": "https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search"
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
        sessions["server-1"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory", stack)
        sessions["search-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search", stack)

        # Execute workflow steps
        # Step 1: Get gene info
        result_1 = await sessions["ncbi-server"].call_tool("get_gene_metadata_by_gene_name", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Predict variant effect
        result_2 = await sessions["ensembl-server"].call_tool("get_vep_hgvs", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Predict protein structure
        result_3 = await sessions["server-1"].call_tool("Protein_structure_prediction_ESMFold", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Search ClinVar pathogenicity
        result_4 = await sessions["search-server"].call_tool("clinvar_search", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
