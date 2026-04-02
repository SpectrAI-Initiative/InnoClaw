---
name: biosample_genomics
description: "BioSample & Genome Cross-Reference - Cross-reference biosample and genome data: NCBI biosample, genome report, sequence reports, and taxonomy. Use this skill for genomics tasks involving get biosample report get genome dataset report by accession get genome sequence reports get taxonomy. Combines 4 tools from 1 SCP server(s)."
---

# BioSample & Genome Cross-Reference

**Discipline**: Genomics | **Tools Used**: 4 | **Servers**: 1

## Description

Cross-reference biosample and genome data: NCBI biosample, genome report, sequence reports, and taxonomy.

## Tools Used

- **`get_biosample_report`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`
- **`get_genome_dataset_report_by_accession`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`
- **`get_genome_sequence_reports`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`
- **`get_taxonomy`** from `ncbi-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI`

## Workflow

1. Get biosample report
2. Get genome dataset report
3. Get sequence reports
4. Get taxonomy

## Test Case

### Input
```json
{
    "biosample": "SAMN15795254",
    "genome_accession": "GCF_000001405.40"
}
```

### Expected Steps
1. Get biosample report
2. Get genome dataset report
3. Get sequence reports
4. Get taxonomy

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
        sessions["ncbi-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/9/Origene-NCBI", stack)

        # Execute workflow steps
        # Step 1: Get biosample report
        result_1 = await sessions["ncbi-server"].call_tool("get_biosample_report", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get genome dataset report
        result_2 = await sessions["ncbi-server"].call_tool("get_genome_dataset_report_by_accession", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get sequence reports
        result_3 = await sessions["ncbi-server"].call_tool("get_genome_sequence_reports", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get taxonomy
        result_4 = await sessions["ncbi-server"].call_tool("get_taxonomy", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
