---
name: disease_protein_profiling
description: "Disease Protein Profiling - Profile a disease protein: UniProt data, AlphaFold structure, InterPro domains, phenotype associations from Ensembl. Use this skill for medical proteomics tasks involving query uniprot download alphafold structure query interpro get phenotype gene. Combines 4 tools from 2 SCP server(s)."
---

# Disease Protein Profiling

**Discipline**: Medical Proteomics | **Tools Used**: 4 | **Servers**: 2

## Description

Profile a disease protein: UniProt data, AlphaFold structure, InterPro domains, phenotype associations from Ensembl.

## Tools Used

- **`query_uniprot`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`download_alphafold_structure`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`query_interpro`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`get_phenotype_gene`** from `ensembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl`

## Workflow

1. Get UniProt protein data
2. Download AlphaFold predicted structure
3. Get InterPro domain info
4. Get phenotype associations

## Test Case

### Input
```json
{
    "uniprot_id": "P04637",
    "gene_symbol": "TP53",
    "species": "homo_sapiens"
}
```

### Expected Steps
1. Get UniProt protein data
2. Download AlphaFold predicted structure
3. Get InterPro domain info
4. Get phenotype associations

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
    "server-1": "https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory",
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
        sessions["server-1"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory", stack)
        sessions["ensembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/12/Origene-Ensembl", stack)

        # Execute workflow steps
        # Step 1: Get UniProt protein data
        result_1 = await sessions["server-1"].call_tool("query_uniprot", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Download AlphaFold predicted structure
        result_2 = await sessions["server-1"].call_tool("download_alphafold_structure", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get InterPro domain info
        result_3 = await sessions["server-1"].call_tool("query_interpro", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Get phenotype associations
        result_4 = await sessions["ensembl-server"].call_tool("get_phenotype_gene", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
