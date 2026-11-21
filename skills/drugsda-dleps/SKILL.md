---
name: drugsda-dleps
description: Calculate disease reversal scores for the provided molecules relative to a specific disease. 
license: MIT license
metadata:
    skill-author: PJLab
---

# DLEPS Score Calculation

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

The description of tool *calculate_dleps_score*.

```tex
Enter a list of candidate small molecules. Based on the input disease name, identify upregulated and downregulated genes associated with the disease state, and predict a reversal score for each small molecule. Generally, a score above 0.2 indicates effectiveness, with higher scores being better.
Args:
    smiles_list (List[str]): List of input SMILES strings, (e.g., ["N[C@@H](Cc1ccc(O)cc1)C(=O)O", "CC(C)C1=CC=CC=C1"])
    disease_name (str): Supportes diseases, e.g., "Aging", "Gout", "Pulmonary fibrosis", "Non-alcoholic fatty liver disease", "Obesity" 
Return:
    status (str): success/error
    msg (str): message
    pred_scores (List[dict]): List of dict, each containing the keys 'smiles' and 'cs_score'. 
        --smiles (str): A SMILES string of smiles_list 
        --cs_score (float): Predicted reverse score
```

How to use tool *calculate_dleps_score* :

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

response = await client.session.call_tool(
    "calculate_dleps_score",
    arguments={
        "smiles_list": smiles_list,
        "disease_name": disease_name
    }
)
result = client.parse_result(response)
pred_scores = result["pred_scores"]

await client.disconnect() 
```

