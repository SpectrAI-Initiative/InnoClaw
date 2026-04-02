---
name: drugsda-p2rank
description:  
license: MIT license
metadata:
    skill-author: PJLab
---

# P2Rank Pocket Location

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

### 2. Locate Protein Pocket

The description of tool *pred_pocket_prank*.

```tex
Use P2Rank to predict ligand binding pockets in the input protein.
Args:
    pdb_file_path (str): Path to the protein structure file (PDB format)
Return:
    status (str): success/error
    msg (str): message
    pred_pockets (List[dict]): List of dict, each containing pocket confidence and center position information. The first pocket (pred_pockets[0]) has the highest score and is usually used for molecular docking.
        --site_id (str): Pocket id
        --probability (float): Predicted confidence score (0~1) of the pocket
        --center_x (float): Center X of the pocket
        --center_y (float): Center Y of the pocket 
        --center_z (float): Center Z of the pocket
```

How to use tool *pred_pocket_prank* :

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

response = await client.session.call_tool(
    "pred_pocket_prank",
    arguments={
        "pdb_file_path": pdb_file_path
    }
)
result = client.parse_result(response)
pred_pockets = result["pred_pockets"]

await client.disconnect() 
```

