---
name: chemical-structure-analysis
description: Analyze chemical structures from compound names to retrieve SMILES, molecular formulas, molecular weight, and LogP values.
license: MIT license
metadata:
    skill-author: PJLab
---

# Chemical Structure Analysis

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

### 2. Chemical Structure Analysis Workflow

Analyze chemical structures from compound names.

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

## Input: Compound name
compound_name = "aspirin"

## Analyze chemical structure
result = await client.session.call_tool(
    "ChemicalStructureAnalyzer",
    arguments={
        "compound_name": compound_name
    }
)

data = client.parse_result(result)

print(f"Compound: {compound_name}")
print(f"SMILES: {data.get('smiles', 'N/A')}")
print(f"Molecular Formula: {data.get('molecular_formula', 'N/A')}")
print(f"Molecular Weight: {data.get('molecular_weight', 'N/A')}")
print(f"LogP: {data.get('logP', 'N/A')}")

await client.disconnect()
```

### Tool Descriptions

**InternAgent Server:**
- `ChemicalStructureAnalyzer`: Analyze chemical structure from compound name
  - Args:
    - `compound_name` (str): Chemical compound name
  - Returns:
    - `smiles` (str): SMILES notation
    - `molecular_formula` (str): Chemical formula
    - `molecular_weight` (float): Molecular weight (g/mol)
    - `logP` (float): Partition coefficient

### Use Cases

- Chemical property lookup
- Drug-likeness assessment
- Compound identification
- Chemical database searches
