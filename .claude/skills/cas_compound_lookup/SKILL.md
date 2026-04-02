---
name: cas_compound_lookup
description: "CAS Number Compound Lookup - Look up compounds by CAS: convert CAS to price/availability, get PubChem data, get ChEMBL info, and structure analysis. Use this skill for chemical information tasks involving CASToPrice get compound by name get molecule by name ChemicalStructureAnalyzer. Combines 4 tools from 4 SCP server(s)."
---

# CAS Number Compound Lookup

**Discipline**: Chemical Information | **Tools Used**: 4 | **Servers**: 4

## Description

Look up compounds by CAS: convert CAS to price/availability, get PubChem data, get ChEMBL info, and structure analysis.

## Tools Used

- **`CASToPrice`** from `server-30` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/30/SciToolAgent-Mat`
- **`get_compound_by_name`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`
- **`get_molecule_by_name`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`ChemicalStructureAnalyzer`** from `server-28` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent`

## Workflow

1. Look up CAS and pricing
2. Get PubChem compound data
3. Get ChEMBL molecule info
4. Analyze chemical structure

## Test Case

### Input
```json
{
    "compound_name": "caffeine"
}
```

### Expected Steps
1. Look up CAS and pricing
2. Get PubChem compound data
3. Get ChEMBL molecule info
4. Analyze chemical structure

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
    "server-30": "https://scp.intern-ai.org.cn/api/v1/mcp/30/SciToolAgent-Mat",
    "pubchem-server": "https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem",
    "chembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL",
    "server-28": "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent"
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
        sessions["server-30"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/30/SciToolAgent-Mat", stack)
        sessions["pubchem-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem", stack)
        sessions["chembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL", stack)
        sessions["server-28"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent", stack)

        # Execute workflow steps
        # Step 1: Look up CAS and pricing
        result_1 = await sessions["server-30"].call_tool("CASToPrice", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get PubChem compound data
        result_2 = await sessions["pubchem-server"].call_tool("get_compound_by_name", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get ChEMBL molecule info
        result_3 = await sessions["chembl-server"].call_tool("get_molecule_by_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Analyze chemical structure
        result_4 = await sessions["server-28"].call_tool("ChemicalStructureAnalyzer", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
