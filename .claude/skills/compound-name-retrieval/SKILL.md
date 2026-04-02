---
name: compound-name-retrieval
description: Retrieve SMILES strings from PubChem database using compound names to obtain molecular structures from common chemical names.
license: MIT license
metadata:
    skill-author: PJLab
---

# Compound Name to SMILES Retrieval

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class DrugSDAClient:
    """DrugSDA-Tool MCP Client"""

    def __init__(self, server_url: str, api_key: str):
        self.server_url = server_url
        self.api_key = api_key
        self.session = None

    async def connect(self):
        """Establish connection and initialize session"""
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
        """Parse MCP tool call result"""
        try:
            if hasattr(result, 'content') and result.content:
                content = result.content[0]
                if hasattr(content, 'text'):
                    return json.loads(content.text)
            return str(result)
        except Exception as e:
            return {"error": f"parse error: {e}", "raw": str(result)}
```

### 2. Compound Name Retrieval Workflow

This workflow retrieves SMILES strings from PubChem using common chemical names.

**Workflow Steps:**

1. **Input Compound Names** - Provide list of chemical names
2. **Query PubChem** - Search for each compound in PubChem database
3. **Extract SMILES** - Retrieve canonical SMILES representations

**Implementation:**

```python
## Initialize client
client = DrugSDAClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

## Input: List of compound names
compound_names = ["aspirin", "caffeine", "ibuprofen"]

## Retrieve SMILES from compound names
result = await client.session.call_tool(
    "retrieve_smiles_from_name",
    arguments={
        "compound_names": compound_names
    }
)

result_data = client.parse_result(result)
smiles_list = result_data["retrieve_smiles"]

## Display results
print("Retrieved SMILES strings:")
for item in smiles_list:
    print(f"Name: {item['compound_name']}")
    print(f"SMILES: {item['smiles']}\n")

await client.disconnect()
```

### Tool Descriptions

**DrugSDA-Tool Server:**
- `retrieve_smiles_from_name`: Retrieve SMILES from PubChem by compound name
  - Args:
    - `compound_names` (list): List of chemical compound names
  - Returns:
    - `retrieve_smiles` (list): List of name-SMILES pairs
      - `compound_name` (str): Input compound name
      - `smiles` (str): Canonical SMILES string

### Input/Output

**Input:**
- `compound_names`: List of chemical names (common names, IUPAC names, or synonyms)

**Output:**
- List of results:
  - `compound_name`: Query compound name
  - `smiles`: Canonical SMILES representation

### Use Cases

- Convert chemical names to machine-readable formats
- Batch retrieve molecular structures
- Validate compound names against PubChem
- Prepare datasets for computational chemistry
- Integration with molecular analysis pipelines

### Performance Notes

- **Data source**: PubChem public database
- **Name matching**: Supports common names, IUPAC names, and synonyms
- **Execution time**: ~1-2 seconds per compound
- **Availability**: Requires internet connection to PubChem API
