---
name: protein_drug_interaction
description: "Protein-Drug Interaction Profiling - Profile protein-drug interactions: protein properties, drug structure, binding affinity prediction, and interaction data. Use this skill for molecular pharmacology tasks involving calculate protein sequence properties ChemicalStructureAnalyzer boltz binding affinity PredictDrugTargetInteraction. Combines 4 tools from 4 SCP server(s)."
---

# Protein-Drug Interaction Profiling

**Discipline**: Molecular Pharmacology | **Tools Used**: 4 | **Servers**: 4

## Description

Profile protein-drug interactions: protein properties, drug structure, binding affinity prediction, and interaction data.

## Tools Used

- **`calculate_protein_sequence_properties`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`ChemicalStructureAnalyzer`** from `server-28` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent`
- **`boltz_binding_affinity`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`
- **`PredictDrugTargetInteraction`** from `server-29` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio`

## Workflow

1. Calculate protein properties
2. Analyze drug structure
3. Predict binding affinity
4. Predict drug-target interaction

## Test Case

### Input
```json
{
    "sequence": "MKTIIALSYIFCLVFA",
    "drug": "caffeine"
}
```

### Expected Steps
1. Calculate protein properties
2. Analyze drug structure
3. Predict binding affinity
4. Predict drug-target interaction

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
    "server-28": "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent",
    "server-3": "https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model",
    "server-29": "https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio"
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
        sessions["server-28"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent", stack)
        sessions["server-3"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model", stack)
        sessions["server-29"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio", stack)

        # Execute workflow steps
        # Step 1: Calculate protein properties
        result_1 = await sessions["server-2"].call_tool("calculate_protein_sequence_properties", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Analyze drug structure
        result_2 = await sessions["server-28"].call_tool("ChemicalStructureAnalyzer", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Predict binding affinity
        result_3 = await sessions["server-3"].call_tool("boltz_binding_affinity", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Predict drug-target interaction
        result_4 = await sessions["server-29"].call_tool("PredictDrugTargetInteraction", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
