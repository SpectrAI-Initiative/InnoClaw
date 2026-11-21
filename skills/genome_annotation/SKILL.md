---
name: genome_annotation
description: "Genome Annotation Pipeline - Annotate a genome: NCBI annotation report, Ensembl gene lookup, UCSC tracks, and KEGG pathway links. Use this skill for genomics tasks involving get genome annotation report get lookup symbol list tracks kegg link. Combines 4 tools from 4 SCP server(s)."
---

# Genome Annotation Pipeline

**Discipline**: Genomics | **Tools Used**: 4 | **Servers**: 4

## Description

Annotate a genome: NCBI annotation report, Ensembl gene lookup, UCSC tracks, and KEGG pathway links.

## Tools Used

- **`get_genome_annotation_report`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`
- **`get_lookup_symbol`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`
- **`list_tracks`** from `ucsc-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC`
- **`kegg_link`** from `kegg-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG`

## Workflow

1. Get NCBI genome annotation
2. Look up gene in Ensembl
3. List UCSC tracks
4. Link to KEGG pathways

## Test Case

### Input
```json
{
    "accession": "GCF_000001405.40",
    "gene_symbol": "BRCA1",
    "genome": "hg38"
}
```

### Expected Steps
1. Get NCBI genome annotation
2. Look up gene in Ensembl
3. List UCSC tracks
4. Link to KEGG pathways

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
    "ucsc-server": "https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC",
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
        sessions["ucsc-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC", stack)
        sessions["kegg-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG", stack)

        # Execute workflow steps
        # Step 1: Get NCBI genome annotation
        result_1 = await sessions["ncbi-server"].call_tool("get_genome_annotation_report", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Look up gene in Ensembl
        result_2 = await sessions["ensembl-server"].call_tool("get_lookup_symbol", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: List UCSC tracks
        result_3 = await sessions["ucsc-server"].call_tool("list_tracks", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Link to KEGG pathways
        result_4 = await sessions["kegg-server"].call_tool("kegg_link", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
