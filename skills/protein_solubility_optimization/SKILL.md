---
name: protein_solubility_optimization
description: "Protein Solubility Optimization - Optimize protein solubility: calculate properties, predict solubility, predict hydrophilicity, and suggest mutations. Use this skill for protein engineering tasks involving calculate protein sequence properties predict protein function ComputeHydrophilicity zero shot sequence prediction. Combines 4 tools from 3 SCP server(s)."
---

# Protein Solubility Optimization

**Discipline**: Protein Engineering | **Tools Used**: 4 | **Servers**: 3

## Description

Optimize protein solubility: calculate properties, predict solubility, predict hydrophilicity, and suggest mutations.

## Tools Used

- **`calculate_protein_sequence_properties`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`predict_protein_function`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`ComputeHydrophilicity`** from `server-29` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio`
- **`zero_shot_sequence_prediction`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`

## Workflow

1. Calculate physicochemical properties
2. Predict solubility
3. Compute hydrophilicity profile
4. Predict beneficial mutations for solubility

## Test Case

### Input
```json
{
    "sequence": "MKTIIALSYIFCLVFAGKRDEFPSTWYV"
}
```

### Expected Steps
1. Calculate physicochemical properties
2. Predict solubility
3. Compute hydrophilicity profile
4. Predict beneficial mutations for solubility

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
    "server-1": "https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory",
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
        sessions["server-2"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool", stack)
        sessions["server-1"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory", stack)
        sessions["server-29"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio", stack)

        # Execute workflow steps
        # Step 1: Calculate physicochemical properties
        result_1 = await sessions["server-2"].call_tool("calculate_protein_sequence_properties", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Predict solubility
        result_2 = await sessions["server-1"].call_tool("predict_protein_function", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute hydrophilicity profile
        result_3 = await sessions["server-29"].call_tool("ComputeHydrophilicity", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Predict beneficial mutations for solubility
        result_4 = await sessions["server-1"].call_tool("zero_shot_sequence_prediction", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
