---
name: comparative_drug_analysis
description: "Comparative Drug Analysis - Compare drugs: structure analysis, PubChem data, FDA safety, and ChEMBL bioactivity. Use this skill for comparative pharmacology tasks involving ChemicalStructureAnalyzer get compound by name get adverse reactions by drug name search activity. Combines 4 tools from 4 SCP server(s)."
---

# Comparative Drug Analysis

**Discipline**: Comparative Pharmacology | **Tools Used**: 4 | **Servers**: 4

## Description

Compare drugs: structure analysis, PubChem data, FDA safety, and ChEMBL bioactivity.

## Tools Used

- **`ChemicalStructureAnalyzer`** from `server-28` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent`
- **`get_compound_by_name`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`
- **`get_adverse_reactions_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`search_activity`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`

## Workflow

1. Analyze structures of both drugs
2. Get PubChem data for both
3. Compare FDA safety profiles
4. Compare ChEMBL bioactivity

## Test Case

### Input
```json
{
    "drug_a": "aspirin",
    "drug_b": "ibuprofen"
}
```

### Expected Steps
1. Analyze structures of both drugs
2. Get PubChem data for both
3. Compare FDA safety profiles
4. Compare ChEMBL bioactivity

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
    "server-28": "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent",
    "pubchem-server": "https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem",
    "fda-drug-server": "https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug",
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
        sessions["server-28"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent", stack)
        sessions["pubchem-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem", stack)
        sessions["fda-drug-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug", stack)
        sessions["chembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL", stack)

        # Execute workflow steps
        # Step 1: Analyze structures of both drugs
        result_1 = await sessions["server-28"].call_tool("ChemicalStructureAnalyzer", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get PubChem data for both
        result_2 = await sessions["pubchem-server"].call_tool("get_compound_by_name", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compare FDA safety profiles
        result_3 = await sessions["fda-drug-server"].call_tool("get_adverse_reactions_by_drug_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Compare ChEMBL bioactivity
        result_4 = await sessions["chembl-server"].call_tool("search_activity", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
