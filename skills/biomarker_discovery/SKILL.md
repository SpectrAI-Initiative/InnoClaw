---
name: biomarker_discovery
description: "Biomarker Discovery Pipeline - Discover biomarkers: TCGA differential expression, NCBI gene data, OpenTargets associations, and clinical relevance. Use this skill for precision medicine tasks involving tcga differential expression analysis get gene metadata by gene name get associated targets by disease efoId clinvar search. Combines 4 tools from 4 SCP server(s)."
---

# Biomarker Discovery Pipeline

**Discipline**: Precision Medicine | **Tools Used**: 4 | **Servers**: 4

## Description

Discover biomarkers: TCGA differential expression, NCBI gene data, OpenTargets associations, and clinical relevance.

## Tools Used

- **`tcga_differential_expression_analysis`** from `tcga-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA`
- **`get_gene_metadata_by_gene_name`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`
- **`get_associated_targets_by_disease_efoId`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`
- **`clinvar_search`** from `search-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search`

## Workflow

1. Run TCGA differential expression
2. Get gene metadata
3. Get OpenTargets associations
4. Search ClinVar variants

## Test Case

### Input
```json
{
    "query": "biomarkers for breast cancer",
    "gene": "BRCA1",
    "disease_efo": "EFO_0000305"
}
```

### Expected Steps
1. Run TCGA differential expression
2. Get gene metadata
3. Get OpenTargets associations
4. Search ClinVar variants

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
    "tcga-server": "https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA",
    "ncbi-server": "https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI",
    "opentargets-server": "https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets",
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
        sessions["tcga-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA", stack)
        sessions["ncbi-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI", stack)
        sessions["opentargets-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets", stack)
        sessions["search-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search", stack)

        # Execute workflow steps
        # Step 1: Run TCGA differential expression
        result_1 = await sessions["tcga-server"].call_tool("tcga_differential_expression_analysis", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get gene metadata
        result_2 = await sessions["ncbi-server"].call_tool("get_gene_metadata_by_gene_name", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get OpenTargets associations
        result_3 = await sessions["opentargets-server"].call_tool("get_associated_targets_by_disease_efoId", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Search ClinVar variants
        result_4 = await sessions["search-server"].call_tool("clinvar_search", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
