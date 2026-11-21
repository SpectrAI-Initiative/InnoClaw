---
name: protocol-extraction-from-pdf
description: Extract laboratory protocols from PDF documents using Thoth-Plan to convert experimental procedures into structured text.
license: MIT license
metadata:
    skill-author: PJLab
---

# Protocol Extraction from PDF

## Usage

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class ThothClient:
    def __init__(self, server_url: str):
        self.server_url = server_url
        self.session = None

    async def connect(self):
        try:
            self.transport = streamablehttp_client(url=self.server_url, sse_read_timeout=60 * 10)
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
        except:
            try:
                return result.content[0].text
            except:
                return {"error": "parse error", "raw": str(result)}

## Initialize and use
client = ThothClient("https://scp.intern-ai.org.cn/api/v1/mcp/19/Thoth-Plan")
await client.connect()

# PDF URL (must be publicly accessible)
pdf_url = "https://example.com/protocol.pdf"

result = await client.session.call_tool("extract_protocol_from_pdf", arguments={"pdf_url": pdf_url})
protocol = client.parse_result(result)
print("Extracted Protocol:")
print(protocol)

await client.disconnect()
```

### Tool: `extract_protocol_from_pdf`
- Args: `pdf_url` (str) - Public URL to PDF file
- Returns: Structured protocol text with numbered steps

### Use Cases
- Lab protocol digitization, SOP extraction, experimental workflow documentation
