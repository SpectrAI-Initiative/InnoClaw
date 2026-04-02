---
name: drugsda-admet
description: Predict the ADMET (absorption, distribution, metabolism, excretion, and toxicity) properties of the input molecules. 
license: MIT license
metadata:
    skill-author: PJLab
---

# Molecular ADMET Properties Prediction

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

### 2. ADMET Prediction

The description of tool *pred_mol_admet*.

```tex
Predict the ADMET (absorption, distribution, metabolism, excretion, and toxicity) properties of the input molecules from smiles list or file.
Args:
    smiles_list (List[str]): List of input SMILES strings, (e.g., ["N[C@@H](Cc1ccc(O)cc1)C(=O)O", "CC(C)C1=CC=CC=C1"]), default is []
    smiles_file (str): Path to a file containing SMILES strings (TXT or CSV format), default is ''
Return:
    status (str): success/error
    msg (str): message
    json_content (List[Dcit]): List of dict, each containing the keys 'smiles', 'physicochemical', 'druglikeness' and 'admet_predictions', where 'admet_predictions' includes over 90 key-value pairs representing various molecular properties 
    json_file (str): Path to the json file saving the ADMET prediction results
```

How to use tool *pred_mol_admet* :

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

response = await client.session.call_tool(
    "pred_mol_admet",
    arguments={
        "smiles_list": smiles_list,
        "smiles_file": ''
    }
)
result = client.parse_result(response)
admet_predictions = result["json_content"]

await client.disconnect() 
```

