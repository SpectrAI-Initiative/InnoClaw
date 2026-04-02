---
name: chromosome_analysis
description: "Chromosome Structure Analysis - Analyze chromosome: NCBI summary, UCSC cytoband, genome sequence, and Ensembl assembly info. Use this skill for cytogenetics tasks involving get chromosome summary get cytoband get chromosome sequence get info assembly. Combines 4 tools from 3 SCP server(s)."
---

# Chromosome Structure Analysis

**Discipline**: Cytogenetics | **Tools Used**: 4 | **Servers**: 3

## Description

Analyze chromosome: NCBI summary, UCSC cytoband, genome sequence, and Ensembl assembly info.

## Tools Used

- **`get_chromosome_summary`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`
- **`get_cytoband`** from `ucsc-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC`
- **`get_chromosome_sequence`** from `ucsc-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC`
- **`get_info_assembly`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`

## Workflow

1. Get chromosome summary from NCBI
2. Get cytoband info from UCSC
3. Get chromosome sequence
4. Get Ensembl assembly info

## Test Case

### Input
```json
{
    "taxon": "human",
    "chromosome": "chr21",
    "genome": "hg38",
    "species": "homo_sapiens"
}
```

### Expected Steps
1. Get chromosome summary from NCBI
2. Get cytoband info from UCSC
3. Get chromosome sequence
4. Get Ensembl assembly info

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
    "ucsc-server": "https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC",
    "ensembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl"
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
        sessions["ucsc-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC", stack)
        sessions["ensembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl", stack)

        # Execute workflow steps
        # Step 1: Get chromosome summary from NCBI
        result_1 = await sessions["ncbi-server"].call_tool("get_chromosome_summary", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get cytoband info from UCSC
        result_2 = await sessions["ucsc-server"].call_tool("get_cytoband", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get chromosome sequence
        result_3 = await sessions["ucsc-server"].call_tool("get_chromosome_sequence", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get Ensembl assembly info
        result_4 = await sessions["ensembl-server"].call_tool("get_info_assembly", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
