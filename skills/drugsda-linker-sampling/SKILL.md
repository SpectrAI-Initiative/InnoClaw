---
name: drugsda-linker-sampling
description: Generate new molecules sampling from the input two warhead fragments. 
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

### 2. Mol2Mol Sampling

The description of tool *linkinvent_linker_sampling_by_warheads*.

```tex
Generate new molecules sampling from the input two warhead fragments.
Args:
    warheads (str): SMILES of two warheads separated by '|', e.g., '*c1ccc(O)cc1|*N1CCNCC1'
    n (int): Number of molecules for sampling
    filter_preset (str): Filter preset, options: ['none', 'minimal', 'default', 'strict'], default is 'default'
    lipinski (bool): Whether to apply Lipinski's rule of five filtering, default is True
    min_linker_atoms (int): Minimum number of atoms in the linker, default is 0
    max_linker_atoms (int): Maximum number of atoms in the linker, default is 0
Return:
    status (str): success/error
    msg (str): message
    save_smiles_file (str): Path to the saved SMILES file
    output_smiles_list (List[str]): List of generated SMILES strings
```

How to use tool *linkinvent_linker_sampling_by_warheads* :

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

response = await client.session.call_tool(
    "linkinvent_linker_sampling_by_warheads",
    arguments={
        "warheads": warheads,
        "n": n,
        "lipinski": True,
        "filter_preset": filter_type,
        "min_linker_atoms": min_linker_atoms,
        "max_linker_atoms": max_linker_atoms
    }
)
result = client.parse_result(response)
output_smiles_list = result["output_smiles_list"]

await client.disconnect() 
```

