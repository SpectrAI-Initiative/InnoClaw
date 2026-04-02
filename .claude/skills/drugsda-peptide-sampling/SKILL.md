---
name: drugsda-peptide-sampling
description: Generate new peptide molecules sampling from the input peptide sequence. 
license: MIT license
metadata:
    skill-author: PJLab
---

# Molecule Generation

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

### 2. Peptide Sampling

The description of tool *pepinvent_peptide_sampling_by_peptide*.

```tex
Generate new peptide molecules sampling from the input peptide sequence.
Args:
    peptide (str): SMILES representation of a peptide sequence, with amino acid residues separated by '|?|', e.g., 'N[C@@H](CCCCN)C(=O)|?|N[C@@H](CC(C)C)C(=O)|?|N[C@@H](CCCNC(=N)N)C(=O)' 
    n (int): Number of molecules for sampling
    filter_preset (str): Filter preset, options: ['none', 'minimal', 'default', 'strict'], default is 'default'
    mw_min (float): Minimum molecular weight, default is 0.0
    mw_max (float): Maximum molecular weight, default is 0.0
Return:
    status (str): success/error
    msg (str): message
    save_smiles_file (str): Path to the saved SMILES file
    output_smiles_list (List[str]): List of generated SMILES strings
```

How to use tool *pepinvent_peptide_sampling_by_peptide* :

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

response = await client.session.call_tool(
    "pepinvent_peptide_sampling_by_peptide",
    arguments={
        "peptide": smiles,
        "n": n,
        "filter_preset": filter_type,
        "mw_min": mw_min,
        "mw_max": mw_max
    }
)
result = client.parse_result(response)
output_smiles_list = result["output_smiles_list"]

await client.disconnect() 
```

