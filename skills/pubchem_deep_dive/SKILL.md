---
name: pubchem_deep_dive
description: "PubChem Deep Dive Analysis - Deep dive into PubChem: compound info, bioassay summary, 3D conformers, synonyms, and general description. Use this skill for chemical databases tasks involving get pubchem compound by cid get assay summary by cid get conformers by cid get compound synonyms by name get general info by compound name. Combines 5 tools from 1 SCP server(s)."
---

# PubChem Deep Dive Analysis

**Discipline**: Chemical Databases | **Tools Used**: 5 | **Servers**: 1

## Description

Deep dive into PubChem: compound info, bioassay summary, 3D conformers, synonyms, and general description.

## Tools Used

- **`get_pubchem_compound_by_cid`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`
- **`get_assay_summary_by_cid`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`
- **`get_conformers_by_cid`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`
- **`get_compound_synonyms_by_name`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`
- **`get_general_info_by_compound_name`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`

## Workflow

1. Get full compound info
2. Get bioassay summary
3. Get 3D conformers
4. Get all synonyms
5. Get general description

## Test Case

### Input
```json
{
    "compound_name": "aspirin",
    "cid": 2244
}
```

### Expected Steps
1. Get full compound info
2. Get bioassay summary
3. Get 3D conformers
4. Get all synonyms
5. Get general description

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
    "pubchem-server": "https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem"
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

        # Execute workflow steps
        # Step 1: Get full compound info
        result_1 = await sessions["pubchem-server"].call_tool("get_pubchem_compound_by_cid", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get bioassay summary
        result_2 = await sessions["pubchem-server"].call_tool("get_assay_summary_by_cid", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get 3D conformers
        result_3 = await sessions["pubchem-server"].call_tool("get_conformers_by_cid", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get all synonyms
        result_4 = await sessions["pubchem-server"].call_tool("get_compound_synonyms_by_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Step 5: Get general description
        result_5 = await sessions["pubchem-server"].call_tool("get_general_info_by_compound_name", arguments={})
        data_5 = parse(result_5)
        print(f"Step 5 result: {json.dumps(data_5, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
