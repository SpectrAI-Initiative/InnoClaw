---
name: drugsda-data-valid
description: Check if the input protein sequence or molecule SMILES string is valid. 
license: MIT license
metadata:
    skill-author: PJLab
---

# Protein or Molecule Data Check

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

### 2. Protein Sequence Valid Check

The description of tool *is_valid_protein_sequence*.

```tex
Check if the input protein sequence string is valid.
Args:
    sequences (List[str]): List of input protein sequences
Return:
    status (str): success/partial_success/error
    msg (str): message
    valid_res (List[dict]): List of dict, each containing the keys 'sequence' and 'is_valid'.
        --sequence (str): A protein sequence of the input sequences list 
        --is_valid (bool): Is the protein sequence valid or not
```

How to use tool *is_valid_protein_sequence* :

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

response = await client.session.call_tool(
    "is_valid_protein_sequence",
    arguments={
        "sequences": sequence_list
    }
)
result = client.parse_result(response)
valid_res = result["valid_res"]

await client.disconnect() 
```

### 3. Molecule SMILCES Valid Check

The description of tool *is_valid_smiles*.

```tex
Check if the input SMILES string is valid
Args:
    smiles_list (List[str]): List of input SMILES strings, (e.g., ["N[C@@H](Cc1ccc(O)cc1)C(=O)O", "CC(C)C1=CC=CC=C1"])
Return:
    status (str): success/partial_success/error
    msg (str): message
    valid_res (List[dict]): List of dict, each containing the keys 'smiles' and 'is_valid'. 
        --smiles (str): A SMILES string of smiles_list
        --is_valid (bool): Is the SMILES valid or not
```

How to use tool *is_valid_smiles* :

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

response = await client.session.call_tool(
    "is_valid_smiles",
    arguments={
        "smiles_list": smiles_list
    }
)
result = client.parse_result(response)
valid_res = result["valid_res"]

await client.disconnect() 
```

