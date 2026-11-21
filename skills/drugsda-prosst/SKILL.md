---
name: drugsda-prosst
description: Given a protein sequence and its structure, employ ProSST model to predict mutation effects and obtain the top-k mutated sequences.
license: MIT license
metadata:
    skill-author: PJLab
---

# Protein Structure Prediction

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

### 2. Tool Description

First, use tool *pred_protein_structure_esmfold* to predict structure of the input sequence.

```tex
Use the ESMFold model for protein 3D structure prediction.
Args:
    sequence (str): Protein sequence
Return:
    status: success/error
    msg: message
    pdb_path (str): The predicted pdb file path
```

Then, Use tool *pred_mutant_sequence* to generate mutated protein sequences.

```tex
Given a protein sequence and its structure, employ the ProSST model to predict mutation effects and obtain the top-k mutated sequences based on their scores.
Args:
    sequence (str): Input protein sequence
    pdb_file_path (str): Path to protein structure file (.pdb)
    top_k (int): Obtain the top-k mutated sequences by score (default: 10) 
Return:
    status (str): success/error
    msg (str): message
    mutated_sequences (List[str]): List of mutated sequences
```

### 3. Example Code

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

response = await client.session.call_tool(
    "pred_protein_structure_esmfold",
    arguments={
        "sequence": sequence
    }
)
result = client.parse_result(response)
protein_structure_file = result["pdb_path"]

response = await client.session.call_tool(
    "pred_mutant_sequence",
    arguments={
        "sequence": sequence,
        "pdb_file_path": protein_structure_file,
        "top_k": n
    }
)
result = client.parse_result(response)
mutated_sequences = result["mutated_sequences"]

await client.disconnect() 
```

