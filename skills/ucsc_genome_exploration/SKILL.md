---
name: ucsc_genome_exploration
description: "UCSC Genome Browser Exploration - Explore genome via UCSC: list genomes, list tracks, get sequence, get track data, and cytoband info. Use this skill for genomics tasks involving list genomes list tracks get sequence get track data get cytoband. Combines 5 tools from 1 SCP server(s)."
---

# UCSC Genome Browser Exploration

**Discipline**: Genomics | **Tools Used**: 5 | **Servers**: 1

## Description

Explore genome via UCSC: list genomes, list tracks, get sequence, get track data, and cytoband info.

## Tools Used

- **`list_genomes`** from `ucsc-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC`
- **`list_tracks`** from `ucsc-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC`
- **`get_sequence`** from `ucsc-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC`
- **`get_track_data`** from `ucsc-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC`
- **`get_cytoband`** from `ucsc-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC`

## Workflow

1. List available genomes
2. List tracks for hg38
3. Get DNA sequence for BRCA1 region
4. Get track data
5. Get cytoband info

## Test Case

### Input
```json
{
    "genome": "hg38",
    "chrom": "chr17",
    "start": 43044295,
    "end": 43125370
}
```

### Expected Steps
1. List available genomes
2. List tracks for hg38
3. Get DNA sequence for BRCA1 region
4. Get track data
5. Get cytoband info

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
        sessions["ucsc-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/13/Origene-UCSC", stack)

        # Execute workflow steps
        # Step 1: List available genomes
        result_1 = await sessions["ucsc-server"].call_tool("list_genomes", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: List tracks for hg38
        result_2 = await sessions["ucsc-server"].call_tool("list_tracks", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get DNA sequence for BRCA1 region
        result_3 = await sessions["ucsc-server"].call_tool("get_sequence", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get track data
        result_4 = await sessions["ucsc-server"].call_tool("get_track_data", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Step 5: Get cytoband info
        result_5 = await sessions["ucsc-server"].call_tool("get_cytoband", arguments={})
        data_5 = parse(result_5)
        print(f"Step 5 result: {json.dumps(data_5, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
