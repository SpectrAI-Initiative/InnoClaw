---
name: kegg-gene-search
description: Search KEGG database for gene information to retrieve pathway associations, functional annotations, and disease links.
license: MIT license
metadata:
    skill-author: PJLab
---

# KEGG Gene Search

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class OrigeneClient:
    """Origene-KEGG MCP Client"""

    def __init__(self, server_url: str, api_key: str):
        self.server_url = server_url
        self.api_key = api_key
        self.session = None

    async def connect(self):
        try:
            self.transport = streamablehttp_client(
                url=self.server_url,
                headers={"SCP-HUB-API-KEY": self.api_key}
            )
            self._stack = AsyncExitStack()
            await self._stack.__aenter__()
            self.read, self.write, self.get_session_id = await self._stack.enter_async_context(self.transport)
            self.session_ctx = ClientSession(self.read, self.write)
            self.session = await self._stack.enter_async_context(self.session_ctx)
            await self.session.initialize()
            return True
        except Exception as e:
            print(f"✗ connect failure: {e}")
            return False

    async def disconnect(self):
        """Disconnect from server"""
        try:
            if hasattr(self, '_stack'):
                await self._stack.aclose()
            print("✓ already disconnect")
        except Exception as e:
            print(f"✗ disconnect error: {e}")
    def parse_result(self, result):
        if isinstance(result, dict):
            content_list = result.get("content") or []
        else:
            content_list = getattr(result, "content", []) or []
        texts = []
        for item in content_list:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    texts.append(item.get("text") or "")
            else:
                if getattr(item, "type", None) == "text":
                    texts.append(getattr(item, "text", "") or "")
        return "".join(texts)
```

### 2. Gene Search Workflow

**Implementation:**

```python
## Initialize client
client = OrigeneClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/5/Origene-KEGG",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

## Search KEGG genes database
result = await client.session.call_tool(
    "kegg_find",
    arguments={
        "db": "genes",
        "query": "p53",
        "option": ""
    }
)

result_data = client.parse_result(result)
print(result_data)

await client.disconnect()
```

### Tool Descriptions

**Origene-KEGG Server:**
- `kegg_find`: Search KEGG database
  - Args:
    - `db` (str): Database to search (e.g., "genes", "pathway")
    - `query` (str): Search query
    - `option` (str): Additional options
  - Returns: KEGG gene entries with pathway and functional information

### Use Cases

- Pathway analysis
- Gene functional annotation
- Disease gene identification
- Systems biology research
