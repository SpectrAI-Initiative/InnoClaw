---
name: protocol-to-executable-json
description: Convert laboratory protocols to executable JSON format using Thoth-OP for automated lab equipment control.
license: MIT license
metadata:
    skill-author: PJLab
---

# Protocol to Executable JSON Conversion

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

# Protocol text
protocol = """
1. Prepare 5'/3' primer working stock by diluting each primer 1:10.
2. Set up PCR master mix according to the table.
3. Pipette 20 µL of PCR master mix into appropriate PCR tubes.
"""

# Convert to executable JSON
result = await client.session.call_tool("generate_executable_json", arguments={"protocol": protocol})
executable_json = client.parse_result(result)

# Execute the JSON
result = await client.session.call_tool("execute_json", arguments={"executable_json": json.dumps(executable_json)})
execution_info = client.parse_result(result)
print("Execution steps:")
print(execution_info)

await client.disconnect()
```

### Tools:
- `generate_executable_json`: Convert protocol text to executable JSON
  - Args: `protocol` (str) - Protocol text
  - Returns: JSON with executable steps

- `execute_json`: Execute JSON protocol
  - Args: `executable_json` (str) - JSON string
  - Returns: Execution log with step-by-step operations

### Use Cases
- Lab automation, robotic liquid handling, protocol standardization, reproducibility
