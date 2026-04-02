---
name: drugsda-file-transfer
description: Implement data transmission between the local computer and the MCP Server using Base64 encoding 
license: MIT license
metadata:
    skill-author: PJLab
---

# File Transfer

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

### 2. Transfer local file to MCP server

Example code:

```python
import base64

client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

## Convert local file to base64 string
local_file = "/path/a.txt"		#Input local file path
with open(local_file, "rb") as f:
    file_content = f.read()
    file_base64_string = base64.b64encode(file_content).decode('utf-8')

## Call tool base64_to_server_file to save base64 string as server file
response = await client.session.call_tool(
    "base64_to_server_file",
    arguments={
        "file_name": "a.txt",
        "file_base64_string": file_base64_string
    }
)
result = client.parse_result(response)
save_file = result["save_file"]	#Server file path after transfer	

await client.disconnect() 
```

### 3. Transfer MCP server file to local

Example code:

```python
import base64

client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

## Call tool server_file_to_base64 to convert server file to base64 string
response = await client.session.call_tool(
    "server_file_to_base64",
    arguments={
        "file_path": "/path/a.txt" 	#Input server file path
    }
)
result = client.parse_result(response)
base64_string = result["base64_string"]
file_name = result["file_name"]

## Convert base64 string to local file
file_data = base64.b64decode(base64_string)    
local_file_path = "/path/" + file_name
with open(local_file_path, "wb") as f:
    f.write(file_data)

await client.disconnect()
```

