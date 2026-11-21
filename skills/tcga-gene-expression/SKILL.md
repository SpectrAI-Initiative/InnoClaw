---
name: tcga-gene-expression
description: Retrieve gene expression data from TCGA (The Cancer Genome Atlas) to analyze cancer-specific expression patterns.
license: MIT license
metadata:
    skill-author: PJLab
---

# TCGA Gene Expression Analysis

## Usage

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class OrigeneClient:
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

## Initialize and use
client = OrigeneClient("https://scp.intern-ai.org.cn/api/v1/mcp/11/Origene-TCGA", "<your-api-key>")
await client.connect()

result = await client.session.call_tool("get_gene_specific_expression_in_cancer_type", arguments={"gene": "TP53"})
print(client.parse_result(result))

await client.disconnect()
```

### Tool: `get_gene_specific_expression_in_cancer_type`
- Args: `gene` (str) - Gene symbol (e.g., "TP53")
- Returns: High/low expression cancers with mean expression and sample counts

### Use Cases
- Cancer genomics, biomarker discovery, tumor characterization, precision oncology
