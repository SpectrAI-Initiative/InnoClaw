---
name: go_term_analysis
description: "Gene Ontology Analysis - Analyze GO terms: ChEMBL GO slim, STRING functional enrichment, STRING annotation, and Ensembl ontology. Use this skill for functional genomics tasks involving get go slim by id get functional enrichment get functional annotation get ontology name. Combines 4 tools from 3 SCP server(s)."
---

# Gene Ontology Analysis

**Discipline**: Functional Genomics | **Tools Used**: 4 | **Servers**: 3

## Description

Analyze GO terms: ChEMBL GO slim, STRING functional enrichment, STRING annotation, and Ensembl ontology.

## Tools Used

- **`get_go_slim_by_id`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`get_functional_enrichment`** from `string-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING`
- **`get_functional_annotation`** from `string-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING`
- **`get_ontology_name`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`

## Workflow

1. Get ChEMBL GO slim
2. Run STRING enrichment
3. Get STRING annotations
4. Get Ensembl ontology details

## Test Case

### Input
```json
{
    "go_id": "GO:0005515",
    "genes": "TP53",
    "species": 9606
}
```

### Expected Steps
1. Get ChEMBL GO slim
2. Run STRING enrichment
3. Get STRING annotations
4. Get Ensembl ontology details

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
    "string-server": "https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING",
    "ensembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl"
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
        sessions["string-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING", stack)
        sessions["ensembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl", stack)

        # Execute workflow steps
        # Step 1: Get ChEMBL GO slim
        result_1 = await sessions["chembl-server"].call_tool("get_go_slim_by_id", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Run STRING enrichment
        result_2 = await sessions["string-server"].call_tool("get_functional_enrichment", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get STRING annotations
        result_3 = await sessions["string-server"].call_tool("get_functional_annotation", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get Ensembl ontology details
        result_4 = await sessions["ensembl-server"].call_tool("get_ontology_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
