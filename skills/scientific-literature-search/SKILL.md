---
name: scientific-literature-search
description: Search scientific literature and research papers using FlowSearch to find relevant academic articles and publications.
license: MIT license
metadata:
    skill-author: PJLab
---

# Scientific Literature Search

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class InternAgentClient:
    """InternAgent MCP Client"""

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
        try:
            if hasattr(result, 'content') and result.content:
                content = result.content[0]
                if hasattr(content, 'text'):
                    return json.loads(content.text)
            return str(result)
        except Exception as e:
            return {"error": f"parse error: {e}", "raw": str(result)}
```

### 2. Literature Search Workflow

Search and analyze scientific literature on a research topic.

**Workflow Steps:**

1. **Define Query** - Specify research question or topic
2. **Execute Search** - Query scientific databases
3. **Analyze Results** - Extract key findings and trends

**Implementation:**

```python
## Initialize client
client = InternAgentClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

## Input: Research query
prompt = "Analyze the latest trends in AI research for drug discovery"

## Execute literature search
result = await client.session.call_tool(
    "FlowSearch",
    arguments={
        "prompt": prompt,
        "file_list": None
    }
)

data = client.parse_result(result)

if data.get('success'):
    print("✅ Literature search completed")
    print(f"\nResults:\n{data['result']}")
else:
    print(f"❌ Search failed: {data.get('error', 'Unknown error')}")

await client.disconnect()
```

### Tool Descriptions

**InternAgent Server:**
- `FlowSearch`: Search and analyze scientific literature
  - Args:
    - `prompt` (str): Research query or question
    - `file_list` (list, optional): Additional files to analyze
  - Returns:
    - `success` (bool): Search status
    - `result` (str): Search results and analysis

### Use Cases

- Literature review for research papers
- Trend analysis in scientific fields
- Systematic literature searches
- Citation and reference discovery
- Research gap identification

### Performance Notes

- **Execution time**: 10-60 seconds depending on query complexity
- **Data sources**: Multiple scientific databases
- **Output**: Comprehensive analysis with key findings
