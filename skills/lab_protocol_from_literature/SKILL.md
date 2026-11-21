---
name: lab_protocol_from_literature
description: "Lab Protocol from Literature - Extract and generate lab protocol: search PubMed, extract protocol from paper, and generate executable protocol. Use this skill for lab science tasks involving pubmed search extract protocol from pdf protocol generation generate executable json. Combines 4 tools from 2 SCP server(s)."
---

# Lab Protocol from Literature

**Discipline**: Lab Science | **Tools Used**: 4 | **Servers**: 2

## Description

Extract and generate lab protocol: search PubMed, extract protocol from paper, and generate executable protocol.

## Tools Used

- **`pubmed_search`** from `search-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search`
- **`extract_protocol_from_pdf`** from `server-19` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/19/Thoth-Plan`
- **`protocol_generation`** from `server-19` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/19/Thoth-Plan`
- **`generate_executable_json`** from `server-19` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/19/Thoth-Plan`

## Workflow

1. Search PubMed for protocols
2. Extract protocol from paper
3. Generate standard protocol
4. Create executable JSON

## Test Case

### Input
```json
{
    "query": "PCR amplification protocol for BRCA1"
}
```

### Expected Steps
1. Search PubMed for protocols
2. Extract protocol from paper
3. Generate standard protocol
4. Create executable JSON

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
    "search-server": "https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search",
    "server-19": "https://scp.intern-ai.org.cn/api/v1/mcp/19/Thoth-Plan"
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
        sessions["search-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/7/Origene-Search", stack)
        sessions["server-19"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/19/Thoth-Plan", stack)

        # Execute workflow steps
        # Step 1: Search PubMed for protocols
        result_1 = await sessions["search-server"].call_tool("pubmed_search", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Extract protocol from paper
        result_2 = await sessions["server-19"].call_tool("extract_protocol_from_pdf", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Generate standard protocol
        result_3 = await sessions["server-19"].call_tool("protocol_generation", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Create executable JSON
        result_4 = await sessions["server-19"].call_tool("generate_executable_json", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
