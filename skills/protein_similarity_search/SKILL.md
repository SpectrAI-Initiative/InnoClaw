---
name: protein_similarity_search
description: "Protein Similarity Search - Search for similar proteins: extract sequence from PDB, search structures with FoldSeek, find homologs with STRING, and check UniProt. Use this skill for bioinformatics tasks involving extract pdb sequence foldseek search get best similarity hits between species search uniprotkb entries. Combines 4 tools from 3 SCP server(s)."
---

# Protein Similarity Search

**Discipline**: Bioinformatics | **Tools Used**: 4 | **Servers**: 3

## Description

Search for similar proteins: extract sequence from PDB, search structures with FoldSeek, find homologs with STRING, and check UniProt.

## Tools Used

- **`extract_pdb_sequence`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`foldseek_search`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`get_best_similarity_hits_between_species`** from `string-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING`
- **`search_uniprotkb_entries`** from `uniprot-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt`

## Workflow

1. Extract sequence from PDB
2. Search similar structures via FoldSeek
3. Find cross-species homologs with STRING
4. Search UniProt for related entries

## Test Case

### Input
```json
{
    "pdb_id": "1AKE"
}
```

### Expected Steps
1. Extract sequence from PDB
2. Search similar structures via FoldSeek
3. Find cross-species homologs with STRING
4. Search UniProt for related entries

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
    "string-server": "https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING",
    "uniprot-server": "https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt"
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
        sessions["string-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/6/Origene-STRING", stack)
        sessions["uniprot-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt", stack)

        # Execute workflow steps
        # Step 1: Extract sequence from PDB
        result_1 = await sessions["server-1"].call_tool("extract_pdb_sequence", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Search similar structures via FoldSeek
        result_2 = await sessions["server-1"].call_tool("foldseek_search", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Find cross-species homologs with STRING
        result_3 = await sessions["string-server"].call_tool("get_best_similarity_hits_between_species", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Search UniProt for related entries
        result_4 = await sessions["uniprot-server"].call_tool("search_uniprotkb_entries", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
