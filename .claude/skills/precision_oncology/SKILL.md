---
name: precision_oncology
description: "Precision Oncology Workflow - Precision oncology: tumor expression profiling, variant analysis, targeted therapy lookup, and clinical trials. Use this skill for precision oncology tasks involving get gene expression across cancers get vep hgvs get associated drugs by target name get clinical studies info by drug name pubmed search. Combines 5 tools from 5 SCP server(s)."
---

# Precision Oncology Workflow

**Discipline**: Precision Oncology | **Tools Used**: 5 | **Servers**: 5

## Description

Precision oncology: tumor expression profiling, variant analysis, targeted therapy lookup, and clinical trials.

## Tools Used

- **`get_gene_expression_across_cancers`** from `tcga-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA`
- **`get_vep_hgvs`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_associated_drugs_by_target_name`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`
- **`get_clinical_studies_info_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`pubmed_search`** from `search-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search`

## Workflow

1. Profile tumor gene expression
2. Analyze driver mutation
3. Find targeted therapies
4. Get clinical trial data
5. Search clinical evidence

## Test Case

### Input
```json
{
    "gene": "BRAF",
    "variant": "ENSP00000288602.7:p.Val600Glu",
    "drug": "vemurafenib"
}
```

### Expected Steps
1. Profile tumor gene expression
2. Analyze driver mutation
3. Find targeted therapies
4. Get clinical trial data
5. Search clinical evidence

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
    "ensembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl",
    "opentargets-server": "https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets",
    "fda-drug-server": "https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug",
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
        sessions["ensembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl", stack)
        sessions["opentargets-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets", stack)
        sessions["fda-drug-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug", stack)
        sessions["search-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search", stack)

        # Execute workflow steps
        # Step 1: Profile tumor gene expression
        result_1 = await sessions["tcga-server"].call_tool("get_gene_expression_across_cancers", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Analyze driver mutation
        result_2 = await sessions["ensembl-server"].call_tool("get_vep_hgvs", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Find targeted therapies
        result_3 = await sessions["opentargets-server"].call_tool("get_associated_drugs_by_target_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get clinical trial data
        result_4 = await sessions["fda-drug-server"].call_tool("get_clinical_studies_info_by_drug_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Step 5: Search clinical evidence
        result_5 = await sessions["search-server"].call_tool("pubmed_search", arguments={})
        data_5 = parse(result_5)
        print(f"Step 5 result: {json.dumps(data_5, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
