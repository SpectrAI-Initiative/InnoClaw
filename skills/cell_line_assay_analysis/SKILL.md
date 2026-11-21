---
name: cell_line_assay_analysis
description: "Cell Line Assay Analysis - Analyze cell line assays: ChEMBL cell line info, assay search, activity data, and target info. Use this skill for cell biology tasks involving get cell line by id search assay search activity get target by name. Combines 4 tools from 1 SCP server(s)."
---

# Cell Line Assay Analysis

**Discipline**: Cell Biology | **Tools Used**: 4 | **Servers**: 1

## Description

Analyze cell line assays: ChEMBL cell line info, assay search, activity data, and target info.

## Tools Used

- **`get_cell_line_by_id`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`search_assay`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`search_activity`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`get_target_by_name`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`

## Workflow

1. Get cell line info
2. Search assays for cell line
3. Search activity data
4. Get target info

## Test Case

### Input
```json
{
    "cell_id": 1,
    "assay_query": "MCF7",
    "target": "estrogen receptor"
}
```

### Expected Steps
1. Get cell line info
2. Search assays for cell line
3. Search activity data
4. Get target info

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
    "chembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL"
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

        # Execute workflow steps
        # Step 1: Get cell line info
        result_1 = await sessions["chembl-server"].call_tool("get_cell_line_by_id", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Search assays for cell line
        result_2 = await sessions["chembl-server"].call_tool("search_assay", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Search activity data
        result_3 = await sessions["chembl-server"].call_tool("search_activity", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get target info
        result_4 = await sessions["chembl-server"].call_tool("get_target_by_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
