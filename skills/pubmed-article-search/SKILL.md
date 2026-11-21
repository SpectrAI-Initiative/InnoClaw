---
name: pubmed-article-search
description: Search PubMed database for scientific articles and publications to retrieve biomedical literature.
license: MIT license
metadata:
    skill-author: PJLab
---

# PubMed Article Search

## Usage

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class ToolUniverseClient:
    def __init__(self, server_url: str, api_key: str):
        self.server_url = server_url
        self.api_key = api_key
        self.session = None

    async def connect(self):
        try:
            self.transport = streamablehttp_client(url=self.server_url, headers={"SCP-HUB-API-KEY": self.api_key})
            self._stack = AsyncExitStack()
            await self._stack.__aenter__()
            self.read, self.write, self.get_session_id = await self._stack.enter_async_context(self.transport)
            self.session_ctx = ClientSession(self.read, self.write)
            self.session = await self._stack.enter_async_context(self.session_ctx)
            await self.session.initialize()
            return True
        except Exception as e:
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
        try:
            if hasattr(result, 'content') and result.content:
                content = result.content[0]
                if hasattr(content, 'text'):
                    return json.loads(content.text)
            return str(result)
        except Exception as e:
            return {"error": f"parse error: {e}", "raw": str(result)}

## Initialize and use
client = ToolUniverseClient("https://scp.intern-ai.org.cn/api/v1/mcp/36/ToolUniverse", "<your-api-key>")
await client.connect()

result = await client.session.call_tool("PubMed_search_articles", arguments={"query": "protein", "limit": 10})
result_data = client.parse_result(result)

for i, article in enumerate(result_data, 1):
    print(f"{i}. {article['title']}")
    print(f"   Authors: {', '.join(article['authors'][:3])}")
    print(f"   Journal: {article['journal']} ({article['year']})")
    print(f"   DOI: {article['doi']}")
    print(f"   URL: {article['url']}\n")

await client.disconnect()
```

### Tool: `PubMed_search_articles`
- Args: `query` (str) - Search query, `limit` (int) - Max results
- Returns: List of articles with title, abstract, authors, journal, year, DOI, URL

### Use Cases
- Literature review, citation discovery, research background, clinical studies
