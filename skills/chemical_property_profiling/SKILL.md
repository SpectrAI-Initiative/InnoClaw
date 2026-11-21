---
name: chemical_property_profiling
description: "Chemical Property Profiling - Profile chemical properties: basic info, hydrophobicity, H-bonds, charges, and molecular complexity. Use this skill for physical chemistry tasks involving calculate mol basic info calculate mol hydrophobicity calculate mol hbond calculate mol charge calculate mol complexity. Combines 5 tools from 1 SCP server(s)."
---

# Chemical Property Profiling

**Discipline**: Physical Chemistry | **Tools Used**: 5 | **Servers**: 1

## Description

Profile chemical properties: basic info, hydrophobicity, H-bonds, charges, and molecular complexity.

## Tools Used

- **`calculate_mol_basic_info`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_mol_hydrophobicity`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_mol_hbond`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_mol_charge`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`
- **`calculate_mol_complexity`** from `server-2` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool`

## Workflow

1. Calculate basic molecular info
2. Compute hydrophobicity descriptors
3. Analyze H-bond properties
4. Calculate partial charges
5. Compute molecular complexity

## Test Case

### Input
```json
{
    "smiles": "CC(=O)Oc1ccccc1C(=O)O"
}
```

### Expected Steps
1. Calculate basic molecular info
2. Compute hydrophobicity descriptors
3. Analyze H-bond properties
4. Calculate partial charges
5. Compute molecular complexity

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
    "server-2": "https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool"
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

        # Execute workflow steps
        # Step 1: Calculate basic molecular info
        result_1 = await sessions["server-2"].call_tool("calculate_mol_basic_info", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Compute hydrophobicity descriptors
        result_2 = await sessions["server-2"].call_tool("calculate_mol_hydrophobicity", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Analyze H-bond properties
        result_3 = await sessions["server-2"].call_tool("calculate_mol_hbond", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Calculate partial charges
        result_4 = await sessions["server-2"].call_tool("calculate_mol_charge", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Step 5: Compute molecular complexity
        result_5 = await sessions["server-2"].call_tool("calculate_mol_complexity", arguments={})
        data_5 = parse(result_5)
        print(f"Step 5 result: {json.dumps(data_5, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
