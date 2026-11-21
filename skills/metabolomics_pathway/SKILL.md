---
name: metabolomics_pathway
description: "Metabolomics Pathway Analysis - Analyze metabolomics: compound identification, KEGG pathway mapping, enzyme links, and PubChem data. Use this skill for metabolomics tasks involving search pubchem by name kegg find kegg link kegg get. Combines 4 tools from 2 SCP server(s)."
---

# Metabolomics Pathway Analysis

**Discipline**: Metabolomics | **Tools Used**: 4 | **Servers**: 2

## Description

Analyze metabolomics: compound identification, KEGG pathway mapping, enzyme links, and PubChem data.

## Tools Used

- **`search_pubchem_by_name`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`
- **`kegg_find`** from `kegg-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG`
- **`kegg_link`** from `kegg-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG`
- **`kegg_get`** from `kegg-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG`

## Workflow

1. Identify compound in PubChem
2. Find in KEGG
3. Link to enzymes
4. Get pathway details

## Test Case

### Input
```json
{
    "metabolite": "glucose",
    "pathway": "hsa00010"
}
```

### Expected Steps
1. Identify compound in PubChem
2. Find in KEGG
3. Link to enzymes
4. Get pathway details

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
    "pubchem-server": "https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem",
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
        sessions["pubchem-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem", stack)
        sessions["kegg-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG", stack)

        # Execute workflow steps
        # Step 1: Identify compound in PubChem
        result_1 = await sessions["pubchem-server"].call_tool("search_pubchem_by_name", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Find in KEGG
        result_2 = await sessions["kegg-server"].call_tool("kegg_find", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Link to enzymes
        result_3 = await sessions["kegg-server"].call_tool("kegg_link", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get pathway details
        result_4 = await sessions["kegg-server"].call_tool("kegg_get", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
