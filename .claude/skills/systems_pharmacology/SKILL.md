---
name: systems_pharmacology
description: "Systems Pharmacology Analysis - Systems pharmacology: drug targets, protein interactions, pathway enrichment, and gene expression. Use this skill for systems pharmacology tasks involving get target by name get string network interaction get functional enrichment get gene expression across cancers. Combines 4 tools from 3 SCP server(s)."
---

# Systems Pharmacology Analysis

**Discipline**: Systems Pharmacology | **Tools Used**: 4 | **Servers**: 3

## Description

Systems pharmacology: drug targets, protein interactions, pathway enrichment, and gene expression.

## Tools Used

- **`get_target_by_name`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`get_string_network_interaction`** from `string-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING`
- **`get_functional_enrichment`** from `string-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING`
- **`get_gene_expression_across_cancers`** from `tcga-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA`

## Workflow

1. Get drug target info
2. Build interaction network
3. Run pathway enrichment
4. Check expression across cancers

## Test Case

### Input
```json
{
    "target": "EGFR",
    "species": 9606
}
```

### Expected Steps
1. Get drug target info
2. Build interaction network
3. Run pathway enrichment
4. Check expression across cancers

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
    "chembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL",
    "string-server": "https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING",
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
        sessions["chembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL", stack)
        sessions["string-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING", stack)
        sessions["tcga-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA", stack)

        # Execute workflow steps
        # Step 1: Get drug target info
        result_1 = await sessions["chembl-server"].call_tool("get_target_by_name", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Build interaction network
        result_2 = await sessions["string-server"].call_tool("get_string_network_interaction", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Run pathway enrichment
        result_3 = await sessions["string-server"].call_tool("get_functional_enrichment", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Check expression across cancers
        result_4 = await sessions["tcga-server"].call_tool("get_gene_expression_across_cancers", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
