---
name: regulatory_region_analysis
description: "Regulatory Region Analysis - Analyze regulatory regions: get overlapping features, binding matrix, sequence, and phenotype associations. Use this skill for epigenomics tasks involving get overlap region get species binding matrix get sequence get phenotype region. Combines 4 tools from 2 SCP server(s)."
---

# Regulatory Region Analysis

**Discipline**: Epigenomics | **Tools Used**: 4 | **Servers**: 2

## Description

Analyze regulatory regions: get overlapping features, binding matrix, sequence, and phenotype associations.

## Tools Used

- **`get_overlap_region`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_species_binding_matrix`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`get_sequence`** from `ucsc-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC`
- **`get_phenotype_region`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`

## Workflow

1. Get overlapping regulatory features
2. Get transcription factor binding
3. Retrieve DNA sequence
4. Check phenotype associations

## Test Case

### Input
```json
{
    "region": "7:140753336-140753436",
    "species": "homo_sapiens",
    "genome": "hg38"
}
```

### Expected Steps
1. Get overlapping regulatory features
2. Get transcription factor binding
3. Retrieve DNA sequence
4. Check phenotype associations

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
    "ucsc-server": "https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC"
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
        sessions["ucsc-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC", stack)

        # Execute workflow steps
        # Step 1: Get overlapping regulatory features
        result_1 = await sessions["ensembl-server"].call_tool("get_overlap_region", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get transcription factor binding
        result_2 = await sessions["ensembl-server"].call_tool("get_species_binding_matrix", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Retrieve DNA sequence
        result_3 = await sessions["ucsc-server"].call_tool("get_sequence", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Check phenotype associations
        result_4 = await sessions["ensembl-server"].call_tool("get_phenotype_region", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
