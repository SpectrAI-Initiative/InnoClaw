---
name: clinical_pharmacology_report
description: "Clinical Pharmacology Report - Generate clinical pharmacology report: PK, PD, mechanism, drug interactions, and special populations. Use this skill for clinical pharmacology tasks involving get pharmacokinetics by drug name get pharmacodynamics by drug name get mechanism of action by drug name get drug interactions by drug name get geriatric use info by drug name. Combines 5 tools from 1 SCP server(s)."
---

# Clinical Pharmacology Report

**Discipline**: Clinical Pharmacology | **Tools Used**: 5 | **Servers**: 1

## Description

Generate clinical pharmacology report: PK, PD, mechanism, drug interactions, and special populations.

## Tools Used

- **`get_pharmacokinetics_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_pharmacodynamics_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_mechanism_of_action_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_drug_interactions_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_geriatric_use_info_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`

## Workflow

1. Get pharmacokinetics
2. Get pharmacodynamics
3. Get mechanism of action
4. Get drug interactions
5. Get geriatric use data

## Test Case

### Input
```json
{
    "drug_name": "metformin"
}
```

### Expected Steps
1. Get pharmacokinetics
2. Get pharmacodynamics
3. Get mechanism of action
4. Get drug interactions
5. Get geriatric use data

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
        sessions["fda-drug-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug", stack)

        # Execute workflow steps
        # Step 1: Get pharmacokinetics
        result_1 = await sessions["fda-drug-server"].call_tool("get_pharmacokinetics_by_drug_name", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get pharmacodynamics
        result_2 = await sessions["fda-drug-server"].call_tool("get_pharmacodynamics_by_drug_name", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get mechanism of action
        result_3 = await sessions["fda-drug-server"].call_tool("get_mechanism_of_action_by_drug_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get drug interactions
        result_4 = await sessions["fda-drug-server"].call_tool("get_drug_interactions_by_drug_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Step 5: Get geriatric use data
        result_5 = await sessions["fda-drug-server"].call_tool("get_geriatric_use_info_by_drug_name", arguments={})
        data_5 = parse(result_5)
        print(f"Step 5 result: {json.dumps(data_5, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
