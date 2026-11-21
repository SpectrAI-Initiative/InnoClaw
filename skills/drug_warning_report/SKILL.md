---
name: drug_warning_report
description: "Drug Warning Intelligence Report - Generate drug warning report: ChEMBL drug warnings, FDA boxed warnings, adverse reactions, and environmental warnings. Use this skill for pharmacovigilance tasks involving get drug warning by id get boxed warning info by drug name get adverse reactions by drug name get environmental warning by drug name. Combines 4 tools from 2 SCP server(s)."
---

# Drug Warning Intelligence Report

**Discipline**: Pharmacovigilance | **Tools Used**: 4 | **Servers**: 2

## Description

Generate drug warning report: ChEMBL drug warnings, FDA boxed warnings, adverse reactions, and environmental warnings.

## Tools Used

- **`get_drug_warning_by_id`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`get_boxed_warning_info_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_adverse_reactions_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_environmental_warning_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`

## Workflow

1. Get ChEMBL drug warnings
2. Get FDA boxed warnings
3. Get adverse reactions
4. Get environmental warnings

## Test Case

### Input
```json
{
    "drug_name": "rosiglitazone",
    "warning_id": 1
}
```

### Expected Steps
1. Get ChEMBL drug warnings
2. Get FDA boxed warnings
3. Get adverse reactions
4. Get environmental warnings

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
    "chembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL",
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
        sessions["chembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL", stack)
        sessions["fda-drug-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug", stack)

        # Execute workflow steps
        # Step 1: Get ChEMBL drug warnings
        result_1 = await sessions["chembl-server"].call_tool("get_drug_warning_by_id", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get FDA boxed warnings
        result_2 = await sessions["fda-drug-server"].call_tool("get_boxed_warning_info_by_drug_name", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get adverse reactions
        result_3 = await sessions["fda-drug-server"].call_tool("get_adverse_reactions_by_drug_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get environmental warnings
        result_4 = await sessions["fda-drug-server"].call_tool("get_environmental_warning_by_drug_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
