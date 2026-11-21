---
name: disease_knowledge_graph
description: "Disease Knowledge Graph - Build disease knowledge graph: OpenTargets targets, drugs, publications, and phenotypes. Use this skill for disease informatics tasks involving get associated targets by disease efoId get associated drugs by target name get publications by drug name get associated phenotypes by disease efoId. Combines 4 tools from 1 SCP server(s)."
---

# Disease Knowledge Graph

**Discipline**: Disease Informatics | **Tools Used**: 4 | **Servers**: 1

## Description

Build disease knowledge graph: OpenTargets targets, drugs, publications, and phenotypes.

## Tools Used

- **`get_associated_targets_by_disease_efoId`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`
- **`get_associated_drugs_by_target_name`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`
- **`get_publications_by_drug_name`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`
- **`get_associated_phenotypes_by_disease_efoId`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`

## Workflow

1. Get associated targets
2. Get drugs for top target
3. Get publications for top drug
4. Get associated phenotypes

## Test Case

### Input
```json
{
    "disease_efo": "EFO_0000311"
}
```

### Expected Steps
1. Get associated targets
2. Get drugs for top target
3. Get publications for top drug
4. Get associated phenotypes

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
        sessions["opentargets-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets", stack)

        # Execute workflow steps
        # Step 1: Get associated targets
        result_1 = await sessions["opentargets-server"].call_tool("get_associated_targets_by_disease_efoId", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get drugs for top target
        result_2 = await sessions["opentargets-server"].call_tool("get_associated_drugs_by_target_name", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get publications for top drug
        result_3 = await sessions["opentargets-server"].call_tool("get_publications_by_drug_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get associated phenotypes
        result_4 = await sessions["opentargets-server"].call_tool("get_associated_phenotypes_by_disease_efoId", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
