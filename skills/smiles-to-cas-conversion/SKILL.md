---
name: smiles-to-cas-conversion
description: Convert SMILES strings to CAS registry numbers using material informatics tools to identify chemical substances.
license: MIT license
metadata:
    skill-author: PJLab
---

# SMILES to CAS Conversion

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class MaterialToolsClient:
    """SciToolAgent-Mat MCP Client"""

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
                    try:
                        return json.loads(content.text)
                    except:
                        return content.text
            return str(result)
        except Exception as e:
            return {"error": f"parse error: {e}", "raw": str(result)}
```

### 2. SMILES to CAS Conversion Workflow

Convert SMILES notation to CAS registry numbers.

**Implementation:**

```python
## Initialize client
client = MaterialToolsClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/30/SciToolAgent-Mat",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

## Input: SMILES strings
smiles_list = [
    "CCO",           # Ethanol
    "CC(=O)O",       # Acetic acid
    "c1ccccc1"       # Benzene
]

print("SMILES to CAS Conversion:")
for smiles in smiles_list:
    result = await client.session.call_tool(
        "SMILESToCAS",
        arguments={"smiles": smiles}
    )
    result_data = client.parse_result(result)
    print(f"SMILES: {smiles}")
    print(f"Result: {result_data}\n")

await client.disconnect()
```

### Tool Descriptions

**SciToolAgent-Mat Server:**
- `SMILESToCAS`: Convert SMILES to CAS registry number
  - Args:
    - `smiles` (str): SMILES notation
  - Returns: CAS registry number

### Use Cases

- Chemical substance identification
- Regulatory compliance checking
- Material safety data sheet lookup
- Chemical inventory management
