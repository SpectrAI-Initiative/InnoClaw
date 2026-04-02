---
name: admet_druglikeness_report
description: "ADMET & Drug-Likeness Report - Generate comprehensive ADMET and drug-likeness report: molecular properties, H-bond analysis, hydrophobicity, topology, and ADMET prediction. Use this skill for medicinal chemistry tasks involving calculate mol basic info calculate mol hbond calculate mol hydrophobicity calculate mol topology pred molecule admet. Combines 5 tools from 2 SCP server(s)."
---

# ADMET & Drug-Likeness Report

**Discipline**: Medicinal Chemistry | **Tools Used**: 5 | **Servers**: 2

## Description

Generate comprehensive ADMET and drug-likeness report: molecular properties, H-bond analysis, hydrophobicity, topology, and ADMET prediction.

## Tools Used

- **`calculate_mol_basic_info`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_mol_hbond`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_mol_hydrophobicity`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_mol_topology`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`pred_molecule_admet`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`

## Workflow

1. Calculate basic molecular info
2. Analyze H-bonds
3. Compute hydrophobicity
4. Calculate topology descriptors
5. Predict ADMET

## Test Case

### Input
```json
{
    "smiles": "c1ccc(CC(=O)O)cc1"
}
```

### Expected Steps
1. Calculate basic molecular info
2. Analyze H-bonds
3. Compute hydrophobicity
4. Calculate topology descriptors
5. Predict ADMET

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
    "server-2": "https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool",
    "server-3": "https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model"
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
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)
        sessions["server-3"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model", stack)

        # Execute workflow steps
        # Step 1: Calculate basic molecular info
        result_1 = await sessions["server-2"].call_tool("calculate_mol_basic_info", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Analyze H-bonds
        result_2 = await sessions["server-2"].call_tool("calculate_mol_hbond", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute hydrophobicity
        result_3 = await sessions["server-2"].call_tool("calculate_mol_hydrophobicity", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Calculate topology descriptors
        result_4 = await sessions["server-2"].call_tool("calculate_mol_topology", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Step 5: Predict ADMET
        result_5 = await sessions["server-3"].call_tool("pred_molecule_admet", arguments={})
        data_5 = parse(result_5)
        print(f"Step 5 result: {json.dumps(data_5, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
