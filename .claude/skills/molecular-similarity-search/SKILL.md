---
name: molecular-similarity-search
description: Search for similar molecules using Tanimoto similarity with Morgan fingerprints to identify structurally related compounds.
license: MIT license
metadata:
    skill-author: PJLab
---

# Molecular Similarity Search

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
        print(f"server url: {self.server_url}")
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
            session_id = self.get_session_id()

            print(f"✓ connect success")
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

### 2. Molecular Similarity Search Workflow

This workflow searches for similar molecules using Tanimoto similarity calculated from Morgan fingerprints.

**Workflow Steps:**

1. **Define Target Molecule** - Specify the query SMILES
2. **Define Candidate Molecules** - Provide list of candidate SMILES
3. **Calculate Similarity** - Compute Tanimoto scores for all candidates
4. **Rank Results** - Sort by similarity score to find most similar molecules

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

## Input: Target molecule and candidate library
target = "CCO"  # Ethanol
candidates = [
    "CCCO",      # Propanol
    "CCCCO",     # Butanol
    "CC(C)O",    # Isopropanol
    "CCC(C)O",   # sec-Butanol
    "C1CC1",     # Cyclopropane
    "CC=O",      # Acetaldehyde
    "CCCOO"      # Propanoic acid
]

## Execute similarity calculation
result = await client.session.call_tool(
    "calculate_smiles_similarity",
    arguments={
        "target_smiles": target,
        "candidate_smiles_list": candidates
    }
)

result_data = client.parse_result(result)
similarities = result_data['similarities']

## Sort and display top 3 most similar molecules
top3_smiles = sorted(similarities, key=lambda x: x['score'], reverse=True)[:3]

print(f"Target molecule: {target}\n")
print("Top 3 most similar molecules:")
for i, item in enumerate(top3_smiles, 1):
    print(f"{i}. {item['smiles']} - Tanimoto score: {item['score']:.4f}")

await client.disconnect()
```

### Tool Descriptions

**DrugSDA-Tool Server:**
- `calculate_smiles_similarity`: Compute molecular similarity using Morgan fingerprints
  - Args:
    - `target_smiles` (str): Query molecule SMILES string
    - `candidate_smiles_list` (list): List of candidate molecule SMILES strings
  - Returns:
    - `similarities` (list): List of similarity scores
      - `smiles` (str): Candidate SMILES string
      - `score` (float): Tanimoto similarity (0-1)

### Input/Output

**Input:**
- `target_smiles`: SMILES string of the query molecule
- `candidate_smiles_list`: List of SMILES strings to compare against

**Output:**
- List of similarity results:
  - `smiles`: Candidate molecule SMILES
  - `score`: Tanimoto similarity coefficient (0-1)
    - 1.0 = identical molecules
    - >0.7 = highly similar
    - 0.4-0.7 = moderately similar
    - <0.4 = dissimilar

### Similarity Interpretation

- **Score > 0.85**: Very high similarity, likely same scaffold
- **Score 0.7-0.85**: High similarity, similar pharmacophore
- **Score 0.5-0.7**: Moderate similarity, related structures
- **Score < 0.5**: Low similarity, different chemical space

### Use Cases

- Virtual screening and library filtering
- Scaffold hopping in drug design
- Chemical space exploration
- Lead compound identification
- Analog searching in compound databases
- Structure-activity relationship studies

### Performance Notes

- **Execution time**: <1 second for up to 1000 candidates
- **Fingerprint**: Morgan fingerprint (radius 2, 2048 bits)
- **Algorithm**: Tanimoto coefficient for binary fingerprints
- **Scalability**: Efficient for large compound libraries
