---
name: pediatric_drug_safety
description: "Pediatric Drug Safety Review - Evaluate pediatric drug safety: pediatric use info, child safety, dosage forms, and overdosage info from FDA. Use this skill for pediatric pharmacology tasks involving get pediatric use info by drug name get child safety info by drug name get dosage forms and strengths by drug name get overdosage info by drug name. Combines 4 tools from 1 SCP server(s)."
---

# Pediatric Drug Safety Review

**Discipline**: Pediatric Pharmacology | **Tools Used**: 4 | **Servers**: 1

## Description

Evaluate pediatric drug safety: pediatric use info, child safety, dosage forms, and overdosage info from FDA.

## Tools Used

- **`get_pediatric_use_info_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_child_safety_info_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_dosage_forms_and_strengths_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_overdosage_info_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`

## Workflow

1. Get pediatric use info
2. Get child safety info
3. Get dosage forms
4. Get overdosage info

## Test Case

### Input
```json
{
    "drug_name": "amoxicillin"
}
```

### Expected Steps
1. Get pediatric use info
2. Get child safety info
3. Get dosage forms
4. Get overdosage info

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
        # Step 1: Get pediatric use info
        result_1 = await sessions["fda-drug-server"].call_tool("get_pediatric_use_info_by_drug_name", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get child safety info
        result_2 = await sessions["fda-drug-server"].call_tool("get_child_safety_info_by_drug_name", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get dosage forms
        result_3 = await sessions["fda-drug-server"].call_tool("get_dosage_forms_and_strengths_by_drug_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get overdosage info
        result_4 = await sessions["fda-drug-server"].call_tool("get_overdosage_info_by_drug_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
