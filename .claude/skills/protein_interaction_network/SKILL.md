---
name: protein_interaction_network
description: "Protein Interaction Network Analysis - Build protein interaction network: map identifiers with STRING, get PPI network, compute enrichment, and link to KEGG pathways. Use this skill for systems biology tasks involving mapping identifiers get string network interaction get ppi enrichment kegg link. Combines 4 tools from 2 SCP server(s)."
---

# Protein Interaction Network Analysis

**Discipline**: Systems Biology | **Tools Used**: 4 | **Servers**: 2

## Description

Build protein interaction network: map identifiers with STRING, get PPI network, compute enrichment, and link to KEGG pathways.

## Tools Used

- **`mapping_identifiers`** from `string-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING`
- **`get_string_network_interaction`** from `string-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING`
- **`get_ppi_enrichment`** from `string-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING`
- **`kegg_link`** from `kegg-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG`

## Workflow

1. Map gene names to STRING IDs
2. Get interaction network
3. Compute PPI enrichment
4. Link to KEGG pathways

## Test Case

### Input
```json
{
    "genes": [
        "TP53",
        "BRCA1",
        "MDM2"
    ],
    "species": 9606
}
```

### Expected Steps
1. Map gene names to STRING IDs
2. Get interaction network
3. Compute PPI enrichment
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
    "string-server": "https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING",
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
        sessions["string-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING", stack)
        sessions["kegg-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG", stack)

        # Execute workflow steps
        # Step 1: Map gene names to STRING IDs
        result_1 = await sessions["string-server"].call_tool("mapping_identifiers", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get interaction network
        result_2 = await sessions["string-server"].call_tool("get_string_network_interaction", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute PPI enrichment
        result_3 = await sessions["string-server"].call_tool("get_ppi_enrichment", arguments={})
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
