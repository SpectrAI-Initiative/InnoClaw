---
name: rare_disease_genetics
description: "Rare Disease Genetic Analysis - Analyze rare disease genetics: Monarch phenotype-disease mapping, ClinVar variants, NCBI gene data, and OpenTargets. Use this skill for rare disease genetics tasks involving get HPO ID by phenotype get joint associated diseases by HPO ID list clinvar search get associated targets by disease efoId. Combines 4 tools from 3 SCP server(s)."
---

# Rare Disease Genetic Analysis

**Discipline**: Rare Disease Genetics | **Tools Used**: 4 | **Servers**: 3

## Description

Analyze rare disease genetics: Monarch phenotype-disease mapping, ClinVar variants, NCBI gene data, and OpenTargets.

## Tools Used

- **`get_HPO_ID_by_phenotype`** from `monarch-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/16/Origene-Monarch`
- **`get_joint_associated_diseases_by_HPO_ID_list`** from `monarch-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/16/Origene-Monarch`
- **`clinvar_search`** from `search-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search`
- **`get_associated_targets_by_disease_efoId`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`

## Workflow

1. Get HPO ID for phenotype
2. Find associated diseases
3. Search ClinVar for pathogenic variants
4. Get OpenTargets target associations

## Test Case

### Input
```json
{
    "phenotype": "seizures",
    "hpo_ids": [
        "HP:0001250"
    ]
}
```

### Expected Steps
1. Get HPO ID for phenotype
2. Find associated diseases
3. Search ClinVar for pathogenic variants
4. Get OpenTargets target associations

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
    "monarch-server": "https://scp.intern-ai.org.cn/api/v1/mcp/16/Origene-Monarch",
    "search-server": "https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search",
    "opentargets-server": "https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets"
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
        sessions["monarch-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/16/Origene-Monarch", stack)
        sessions["search-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search", stack)
        sessions["opentargets-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets", stack)

        # Execute workflow steps
        # Step 1: Get HPO ID for phenotype
        result_1 = await sessions["monarch-server"].call_tool("get_HPO_ID_by_phenotype", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Find associated diseases
        result_2 = await sessions["monarch-server"].call_tool("get_joint_associated_diseases_by_HPO_ID_list", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Search ClinVar for pathogenic variants
        result_3 = await sessions["search-server"].call_tool("clinvar_search", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get OpenTargets target associations
        result_4 = await sessions["opentargets-server"].call_tool("get_associated_targets_by_disease_efoId", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
