---
name: genetic_counseling_report
description: "Genetic Counseling Variant Report - Generate variant report for genetic counseling: VEP, ClinVar, gene phenotype, and literature evidence. Use this skill for clinical genetics tasks involving get vep hgvs clinvar search get phenotype gene pubmed search. Combines 4 tools from 2 SCP server(s)."
---

# Genetic Counseling Variant Report

**Discipline**: Clinical Genetics | **Tools Used**: 4 | **Servers**: 2

## Description

Generate variant report for genetic counseling: VEP, ClinVar, gene phenotype, and literature evidence.

## Tools Used

- **`get_vep_hgvs`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`clinvar_search`** from `search-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search`
- **`get_phenotype_gene`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`pubmed_search`** from `search-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search`

## Workflow

1. Predict variant effect with VEP
2. Search ClinVar significance
3. Get gene-phenotype associations
4. Search PubMed for clinical evidence

## Test Case

### Input
```json
{
    "hgvs": "ENSP00000269305.4:p.Arg175His",
    "gene": "TP53"
}
```

### Expected Steps
1. Predict variant effect with VEP
2. Search ClinVar significance
3. Get gene-phenotype associations
4. Search PubMed for clinical evidence

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
        sessions["search-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search", stack)

        # Execute workflow steps
        # Step 1: Predict variant effect with VEP
        result_1 = await sessions["ensembl-server"].call_tool("get_vep_hgvs", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Search ClinVar significance
        result_2 = await sessions["search-server"].call_tool("clinvar_search", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get gene-phenotype associations
        result_3 = await sessions["ensembl-server"].call_tool("get_phenotype_gene", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Search PubMed for clinical evidence
        result_4 = await sessions["search-server"].call_tool("pubmed_search", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
