---
name: epigenetics_drug
description: "Epigenetics & Drug Response - Link epigenetics to drug response: gene regulation, variant effects, drug interactions, and expression. Use this skill for epigenetic pharmacology tasks involving get overlap region get vep hgvs get drug interactions by drug name get gene expression across cancers. Combines 4 tools from 3 SCP server(s)."
---

# Epigenetics & Drug Response

**Discipline**: Epigenetic Pharmacology | **Tools Used**: 4 | **Servers**: 3

## Description

Link epigenetics to drug response: gene regulation, variant effects, drug interactions, and expression.

## Tools Used

- **`get_overlap_region`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_vep_hgvs`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_drug_interactions_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_gene_expression_across_cancers`** from `tcga-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA`

## Workflow

1. Get regulatory overlap
2. Predict variant effects
3. Check drug interactions
4. Analyze gene expression

## Test Case

### Input
```json
{
    "region": "7:140753336-140753436",
    "drug": "vemurafenib",
    "gene": "BRAF"
}
```

### Expected Steps
1. Get regulatory overlap
2. Predict variant effects
3. Check drug interactions
4. Analyze gene expression

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
    "fda-drug-server": "https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug",
    "tcga-server": "https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA"
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
        sessions["fda-drug-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug", stack)
        sessions["tcga-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA", stack)

        # Execute workflow steps
        # Step 1: Get regulatory overlap
        result_1 = await sessions["ensembl-server"].call_tool("get_overlap_region", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Predict variant effects
        result_2 = await sessions["ensembl-server"].call_tool("get_vep_hgvs", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Check drug interactions
        result_3 = await sessions["fda-drug-server"].call_tool("get_drug_interactions_by_drug_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Analyze gene expression
        result_4 = await sessions["tcga-server"].call_tool("get_gene_expression_across_cancers", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
