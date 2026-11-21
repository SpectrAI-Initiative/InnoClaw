---
name: antibody_drug_development
description: "Antibody Drug Development - Develop antibody drug: target protein analysis, biotherapeutic lookup, protein properties, and interaction prediction. Use this skill for biologics tasks involving get uniprotkb entry by accession get biotherapeutic by name ComputeProtPara ComputeHydrophilicity. Combines 4 tools from 3 SCP server(s)."
---

# Antibody Drug Development

**Discipline**: Biologics | **Tools Used**: 4 | **Servers**: 3

## Description

Develop antibody drug: target protein analysis, biotherapeutic lookup, protein properties, and interaction prediction.

## Tools Used

- **`get_uniprotkb_entry_by_accession`** from `uniprot-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt`
- **`get_biotherapeutic_by_name`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`ComputeProtPara`** from `server-29` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio`
- **`ComputeHydrophilicity`** from `server-29` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio`

## Workflow

1. Get target protein info
2. Look up biotherapeutic in ChEMBL
3. Compute protein parameters
4. Analyze hydrophilicity

## Test Case

### Input
```json
{
    "target_accession": "P04637",
    "biotherapeutic": "trastuzumab",
    "sequence": "MKTIIALSYIFCLVFA"
}
```

### Expected Steps
1. Get target protein info
2. Look up biotherapeutic in ChEMBL
3. Compute protein parameters
4. Analyze hydrophilicity

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
    "chembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL",
    "server-29": "https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio"
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
        sessions["chembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL", stack)
        sessions["server-29"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio", stack)

        # Execute workflow steps
        # Step 1: Get target protein info
        result_1 = await sessions["uniprot-server"].call_tool("get_uniprotkb_entry_by_accession", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Look up biotherapeutic in ChEMBL
        result_2 = await sessions["chembl-server"].call_tool("get_biotherapeutic_by_name", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute protein parameters
        result_3 = await sessions["server-29"].call_tool("ComputeProtPara", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Analyze hydrophilicity
        result_4 = await sessions["server-29"].call_tool("ComputeHydrophilicity", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
