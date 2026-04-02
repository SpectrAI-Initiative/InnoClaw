---
name: substance_toxicology
description: "Substance Toxicology Report - Toxicology report: PubChem substance data, FDA toxicology, carcinogenicity data, and environmental warnings. Use this skill for toxicology tasks involving get substance by name get nonclinical toxicology info by drug name get carcinogenic mutagenic fertility impairment info by drug name get environmental warning by drug name. Combines 4 tools from 2 SCP server(s)."
---

# Substance Toxicology Report

**Discipline**: Toxicology | **Tools Used**: 4 | **Servers**: 2

## Description

Toxicology report: PubChem substance data, FDA toxicology, carcinogenicity data, and environmental warnings.

## Tools Used

- **`get_substance_by_name`** from `pubchem-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem`
- **`get_nonclinical_toxicology_info_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_carcinogenic_mutagenic_fertility_impairment_info_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`
- **`get_environmental_warning_by_drug_name`** from `fda-drug-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug`

## Workflow

1. Get PubChem substance data
2. Get FDA nonclinical toxicology
3. Get carcinogenicity data
4. Get environmental warnings

## Test Case

### Input
```json
{
    "substance": "benzene",
    "drug_name": "benzene"
}
```

### Expected Steps
1. Get PubChem substance data
2. Get FDA nonclinical toxicology
3. Get carcinogenicity data
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
    "pubchem-server": "https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem",
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
        sessions["pubchem-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/8/Origene-PubChem", stack)
        sessions["fda-drug-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/14/Origene-FDADrug", stack)

        # Execute workflow steps
        # Step 1: Get PubChem substance data
        result_1 = await sessions["pubchem-server"].call_tool("get_substance_by_name", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get FDA nonclinical toxicology
        result_2 = await sessions["fda-drug-server"].call_tool("get_nonclinical_toxicology_info_by_drug_name", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get carcinogenicity data
        result_3 = await sessions["fda-drug-server"].call_tool("get_carcinogenic_mutagenic_fertility_impairment_info_by_drug_name", arguments={})
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
