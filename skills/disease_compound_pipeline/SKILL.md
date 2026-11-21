---
name: disease_compound_pipeline
description: "Disease-Specific Compound Screening - Screen compounds for disease: get DLEPS score for disease relevance, predict ADMET, and check drug-likeness. Use this skill for drug discovery tasks involving calculate dleps score pred molecule admet calculate mol drug chemistry get compound by name. Combines 4 tools from 3 SCP server(s)."
---

# Disease-Specific Compound Screening

**Discipline**: Drug Discovery | **Tools Used**: 4 | **Servers**: 3

## Description

Screen compounds for disease: get DLEPS score for disease relevance, predict ADMET, and check drug-likeness.

## Tools Used

- **`calculate_dleps_score`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`
- **`pred_molecule_admet`** from `server-3` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model`
- **`calculate_mol_drug_chemistry`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`get_compound_by_name`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`

## Workflow

1. Calculate DLEPS disease relevance score
2. Predict ADMET properties
3. Evaluate drug-likeness
4. Get PubChem compound details

## Test Case

### Input
```json
{
    "smiles": [
        "CC(=O)Oc1ccccc1C(=O)O"
    ],
    "disease_name": "breast cancer"
}
```

### Expected Steps
1. Calculate DLEPS disease relevance score
2. Predict ADMET properties
3. Evaluate drug-likeness
4. Get PubChem compound details

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
    "server-3": "https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model",
    "server-2": "https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool",
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
        sessions["server-3"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model", stack)
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)
        sessions["pubchem-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem", stack)

        # Execute workflow steps
        # Step 1: Calculate DLEPS disease relevance score
        result_1 = await sessions["server-3"].call_tool("calculate_dleps_score", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Predict ADMET properties
        result_2 = await sessions["server-3"].call_tool("pred_molecule_admet", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Evaluate drug-likeness
        result_3 = await sessions["server-2"].call_tool("calculate_mol_drug_chemistry", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get PubChem compound details
        result_4 = await sessions["pubchem-server"].call_tool("get_compound_by_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
