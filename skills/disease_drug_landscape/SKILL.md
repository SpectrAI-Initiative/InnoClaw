---
name: disease_drug_landscape
description: "Disease-Drug Landscape Analysis - Map the drug landscape for a disease: OpenTargets disease drugs, FDA indications, and clinical studies. Use this skill for drug discovery tasks involving get associated drugs by target name get drug names by indication get clinical studies info by drug name. Combines 3 tools from 2 SCP server(s)."
---

# Disease-Drug Landscape Analysis

**Discipline**: Drug Discovery | **Tools Used**: 3 | **Servers**: 2

## Description

Map the drug landscape for a disease: OpenTargets disease drugs, FDA indications, and clinical studies.

## Tools Used

- **`get_associated_drugs_by_target_name`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`
- **`get_drug_names_by_indication`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_clinical_studies_info_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`

## Workflow

1. Get associated drugs from OpenTargets
2. Find drugs by indication in FDA
3. Get clinical studies for top drug

## Test Case

### Input
```json
{
    "target_name": "EGFR",
    "indication": "non-small cell lung cancer"
}
```

### Expected Steps
1. Get associated drugs from OpenTargets
2. Find drugs by indication in FDA
3. Get clinical studies for top drug

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
    "opentargets-server": "https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets",
    "fda-drug-server": "https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug"
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
        sessions["opentargets-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets", stack)
        sessions["fda-drug-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug", stack)

        # Execute workflow steps
        # Step 1: Get associated drugs from OpenTargets
        result_1 = await sessions["opentargets-server"].call_tool("get_associated_drugs_by_target_name", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Find drugs by indication in FDA
        result_2 = await sessions["fda-drug-server"].call_tool("get_drug_names_by_indication", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get clinical studies for top drug
        result_3 = await sessions["fda-drug-server"].call_tool("get_clinical_studies_info_by_drug_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
