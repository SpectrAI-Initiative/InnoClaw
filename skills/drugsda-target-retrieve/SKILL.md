---
name: drugsda-target-retrieve
description: Search the protein information from the input gene name and downloads the optimal PDB or AlphaFold structures. 
license: MIT license
metadata:
    skill-author: PJLab
---

# Target Protein Retrieve

## Usage

### 1. MCP Server Definition

```python
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class DrugSDAClient:    
    def __init__(self, server_url: str):
        self.server_url = server_url
        self.session = None
        
    async def connect(self):
        print(f"server url: {self.server_url}")
        try:
            self.transport = streamablehttp_client(
                url=self.server_url,
                headers={"SCP-HUB-API-KEY": "sk-a0033dde-b3cd-413b-adbe-980bc78d6126"}
            )
            self._stack = AsyncExitStack()
            await self._stack.__aenter__()
            self.read, self.write, self.get_session_id = await self._stack.enter_async_context(self.transport)
            
            self.session_ctx = ClientSession(self.read, self.write)
            self.session = await self._stack.enter_async_context(self.session_ctx)

            await self.session.initialize()
            session_id = self.get_session_id()
            
            print(f"✓ connect success")
            return True
            
        except Exception as e:
            print(f"✗ connect failure: {e}")
            import traceback
            traceback.print_exc()
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

### 2. Retrieve Protein Structure

The description of tool *retrieve_protein_structure_by_gene_name*.

```tex
Search the protein information from the input gene name and downloads the optimal PDB or AlphaFold structures. Note that species support is limited to humans only.
Args:
    gene_name (str): Input gene name (e.g., 'TP53') 
Return:
    status (str): success/error
    msg (str): message
    prot_structure_path (str): Path to the downloaded protein structure file (pdb format)
```

How to use tool *retrieve_protein_structure_by_gene_name* :

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

response = await client.session.call_tool(
    "retrieve_protein_structure_by_gene_name",
    arguments={
        "gene_name": gene_name
    }
)
result = client.parse_result(response)
prot_structure_path = result["prot_structure_path"]

await client.disconnect() 
```

