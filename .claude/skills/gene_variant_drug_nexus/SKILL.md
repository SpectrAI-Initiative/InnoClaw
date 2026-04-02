---
name: gene_variant_drug_nexus
description: "Gene-Variant-Drug Nexus - Connect gene variants to drugs: variant effect, gene-disease link, drug associations, and clinical evidence. Use this skill for translational genomics tasks involving get vep hgvs get associated targets by disease efoId get associated drugs by target name clinvar search. Combines 4 tools from 3 SCP server(s)."
---

# Gene-Variant-Drug Nexus

**Discipline**: Translational Genomics | **Tools Used**: 4 | **Servers**: 3

## Description

Connect gene variants to drugs: variant effect, gene-disease link, drug associations, and clinical evidence.

## Tools Used

- **`get_vep_hgvs`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_associated_targets_by_disease_efoId`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`
- **`get_associated_drugs_by_target_name`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`
- **`clinvar_search`** from `search-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search`

## Workflow

1. Predict variant effect
2. Get disease-target associations
3. Find drugs for target
4. Check ClinVar clinical significance

## Test Case

### Input
```json
{
    "hgvs": "ENSP00000269305.4:p.Arg175His",
    "disease_efo": "EFO_0000311"
}
```

### Expected Steps
1. Predict variant effect
2. Get disease-target associations
3. Find drugs for target
4. Check ClinVar clinical significance

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
        sessions["ensembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl", stack)
        sessions["opentargets-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets", stack)
        sessions["search-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search", stack)

        # Execute workflow steps
        # Step 1: Predict variant effect
        result_1 = await sessions["ensembl-server"].call_tool("get_vep_hgvs", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get disease-target associations
        result_2 = await sessions["opentargets-server"].call_tool("get_associated_targets_by_disease_efoId", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Find drugs for target
        result_3 = await sessions["opentargets-server"].call_tool("get_associated_drugs_by_target_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Check ClinVar clinical significance
        result_4 = await sessions["search-server"].call_tool("clinvar_search", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
