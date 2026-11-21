---
name: enzyme_engineering
description: "Enzyme Active Site Engineering - Engineer enzyme: identify active site residues, predict pocket, analyze binding site, and predict mutations. Use this skill for enzymology tasks involving predict functional residue run fpocket get binding site by id pred mutant sequence. Combines 4 tools from 3 SCP server(s)."
---

# Enzyme Active Site Engineering

**Discipline**: Enzymology | **Tools Used**: 4 | **Servers**: 3

## Description

Engineer enzyme: identify active site residues, predict pocket, analyze binding site, and predict mutations.

## Tools Used

- **`predict_functional_residue`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`run_fpocket`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`
- **`get_binding_site_by_id`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`pred_mutant_sequence`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`

## Workflow

1. Identify active site residues
2. Predict catalytic pocket
3. Get binding site info from ChEMBL
4. Predict improved mutant sequences

## Test Case

### Input
```json
{
    "sequence": "MKTIIALSYIFCLVFA"
}
```

### Expected Steps
1. Identify active site residues
2. Predict catalytic pocket
3. Get binding site info from ChEMBL
4. Predict improved mutant sequences

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
    "server-1": "https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory",
    "server-3": "https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model",
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
        sessions["server-1"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory", stack)
        sessions["server-3"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model", stack)
        sessions["chembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL", stack)

        # Execute workflow steps
        # Step 1: Identify active site residues
        result_1 = await sessions["server-1"].call_tool("predict_functional_residue", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Predict catalytic pocket
        result_2 = await sessions["server-3"].call_tool("run_fpocket", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get binding site info from ChEMBL
        result_3 = await sessions["chembl-server"].call_tool("get_binding_site_by_id", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Predict improved mutant sequences
        result_4 = await sessions["server-3"].call_tool("pred_mutant_sequence", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
