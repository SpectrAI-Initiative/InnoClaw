---
name: antibody_target_analysis
description: "Antibody-Target Analysis - Analyze an antibody target: UniProt protein info, InterPro domains, protein properties, and biotherapeutic data from ChEMBL. Use this skill for immunology tasks involving get uniprotkb entry by accession query interpro ComputeProtPara get biotherapeutic by name. Combines 4 tools from 4 SCP server(s)."
---

# Antibody-Target Analysis

**Discipline**: Immunology | **Tools Used**: 4 | **Servers**: 4

## Description

Analyze an antibody target: UniProt protein info, InterPro domains, protein properties, and biotherapeutic data from ChEMBL.

## Tools Used

- **`get_uniprotkb_entry_by_accession`** from `uniprot-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt`
- **`query_interpro`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`ComputeProtPara`** from `server-29` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio`
- **`get_biotherapeutic_by_name`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`

## Workflow

1. Get full UniProt entry
2. Get domain annotations
3. Compute protein parameters
4. Search ChEMBL biotherapeutics

## Test Case

### Input
```json
{
    "uniprot_accession": "P04637",
    "protein_sequence": "MEEPQSDPSVEPPLSQETFS"
}
```

### Expected Steps
1. Get full UniProt entry
2. Get domain annotations
3. Compute protein parameters
4. Search ChEMBL biotherapeutics

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
    "uniprot-server": "https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt",
    "server-1": "https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory",
    "server-29": "https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio",
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
        sessions["uniprot-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt", stack)
        sessions["server-1"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory", stack)
        sessions["server-29"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio", stack)
        sessions["chembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL", stack)

        # Execute workflow steps
        # Step 1: Get full UniProt entry
        result_1 = await sessions["uniprot-server"].call_tool("get_uniprotkb_entry_by_accession", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get domain annotations
        result_2 = await sessions["server-1"].call_tool("query_interpro", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute protein parameters
        result_3 = await sessions["server-29"].call_tool("ComputeProtPara", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Search ChEMBL biotherapeutics
        result_4 = await sessions["chembl-server"].call_tool("get_biotherapeutic_by_name", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
