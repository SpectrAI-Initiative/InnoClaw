---
name: affinity_maturation
description: "Affinity Maturation Pipeline - Affinity maturation: compute binding affinity, predict mutations, compute hydrophilicity, and predict drug-target interaction. Use this skill for antibody engineering tasks involving ComputeAffinityCalculator zero shot sequence prediction ComputeHydrophilicity PredictDrugTargetInteraction. Combines 4 tools from 3 SCP server(s)."
---

# Affinity Maturation Pipeline

**Discipline**: Antibody Engineering | **Tools Used**: 4 | **Servers**: 3

## Description

Affinity maturation: compute binding affinity, predict mutations, compute hydrophilicity, and predict drug-target interaction.

## Tools Used

- **`ComputeAffinityCalculator`** from `server-28` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent`
- **`zero_shot_sequence_prediction`** from `server-1` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory`
- **`ComputeHydrophilicity`** from `server-29` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio`
- **`PredictDrugTargetInteraction`** from `server-29` (sse) - `https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio`

## Workflow

1. Compute baseline affinity
2. Predict beneficial mutations
3. Analyze hydrophilicity changes
4. Predict improved interactions

## Test Case

### Input
```json
{
    "sequence": "MKTIIALSYIFCLVFA"
}
```

### Expected Steps
1. Compute baseline affinity
2. Predict beneficial mutations
3. Analyze hydrophilicity changes
4. Predict improved interactions

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
    "server-28": "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent",
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
        sessions["server-28"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent", stack)
        sessions["server-1"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/1/VenusFactory", stack)
        sessions["server-29"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio", stack)

        # Execute workflow steps
        # Step 1: Compute baseline affinity
        result_1 = await sessions["server-28"].call_tool("ComputeAffinityCalculator", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Predict beneficial mutations
        result_2 = await sessions["server-1"].call_tool("zero_shot_sequence_prediction", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Analyze hydrophilicity changes
        result_3 = await sessions["server-29"].call_tool("ComputeHydrophilicity", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Predict improved interactions
        result_4 = await sessions["server-29"].call_tool("PredictDrugTargetInteraction", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
