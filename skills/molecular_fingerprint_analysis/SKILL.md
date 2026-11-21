---
name: molecular_fingerprint_analysis
description: "Molecular Fingerprint Analysis - Fingerprint analysis: topology descriptors, structure complexity, similarity calculation, and AromaticityAnalysis. Use this skill for cheminformatics tasks involving calculate mol topology calculate mol structure complexity calculate smiles similarity AromaticityAnalyzer. Combines 4 tools from 2 SCP server(s)."
---

# Molecular Fingerprint Analysis

**Discipline**: Cheminformatics | **Tools Used**: 4 | **Servers**: 2

## Description

Fingerprint analysis: topology descriptors, structure complexity, similarity calculation, and AromaticityAnalysis.

## Tools Used

- **`calculate_mol_topology`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_mol_structure_complexity`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_smiles_similarity`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`AromaticityAnalyzer`** from `server-28` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent`

## Workflow

1. Calculate topological fingerprints
2. Analyze structural complexity
3. Compute pairwise similarity
4. Analyze aromaticity

## Test Case

### Input
```json
{
    "smiles": "c1ccc(-c2ccccc2)cc1"
}
```

### Expected Steps
1. Calculate topological fingerprints
2. Analyze structural complexity
3. Compute pairwise similarity
4. Analyze aromaticity

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
    "server-2": "https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool",
    "server-28": "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent"
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
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)
        sessions["server-28"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent", stack)

        # Execute workflow steps
        # Step 1: Calculate topological fingerprints
        result_1 = await sessions["server-2"].call_tool("calculate_mol_topology", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Analyze structural complexity
        result_2 = await sessions["server-2"].call_tool("calculate_mol_structure_complexity", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute pairwise similarity
        result_3 = await sessions["server-2"].call_tool("calculate_smiles_similarity", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Analyze aromaticity
        result_4 = await sessions["server-28"].call_tool("AromaticityAnalyzer", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
