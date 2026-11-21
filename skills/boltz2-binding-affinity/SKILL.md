---
name: boltz2-binding-affinity
description: Predict protein-ligand binding affinity using Boltz-2 model to assess molecular interactions and binding probability for drug discovery.
license: MIT license
metadata:
    skill-author: PJLab
---

# Boltz-2 Protein-Ligand Binding Affinity Prediction

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class DrugSDAClient:
    """DrugSDA-Model MCP Client"""

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

### 2. Boltz-2 Binding Affinity Workflow

This workflow predicts protein-ligand binding affinity using the Boltz-2 deep learning model, providing affinity probabilities and 3D complex structures.

**Workflow Steps:**

1. **Prepare Input** - Define protein sequence and SMILES list for ligands
2. **Run Boltz-2 Prediction** - Calculate binding affinity probability for each ligand
3. **Analyze Results** - Extract affinity scores and structure files

**Implementation:**

```python
## Initialize client
client = DrugSDAClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

## Input: Protein sequence and ligand SMILES
sequence = 'PIVQNLQGQMVHQCISPRTLNAWVKVVEEKAFSPEVIPMFSALSCGATPQDLNTMLNTVGGHQAAMQMLKETINEEAAEWDRLHPVHAGPIAPGQMREPRGSDIAGTTSTLQEQIGWMTHNPPIPVGEIYKRWIILGLNKIVRMYSPTSILDIRQGPKEPFRDYVDRFYKTLRAEQASQEVKNAATETLLVQNANPDCKTILKALGPGATLEEMMTACQG'
protein = [{'chain': 'A', 'sequence': sequence}]
smiles_list = ['N[C@@H](Cc1ccc(O)cc1)C(=O)O', "CC(C)C1=CC=CC=C1"]

## Execute Boltz-2 binding affinity prediction
result = await client.session.call_tool(
    "boltz_binding_affinity",
    arguments={
        "protein": protein,
        "smiles_list": smiles_list
    }
)

result_data = client.parse_result(result)
boltz_res = result_data["boltz_res"]

## Display results
for i, item in enumerate(boltz_res, 1):
    print(f"{i}. SMILES: {item['smiles']}")
    print(f"   Affinity Probability: {item['affinity_probability']:.4f}")
    print(f"   Structure File: {item['cif_file']}\n")

await client.disconnect()
```

### Tool Descriptions

**DrugSDA-Model Server:**
- `boltz_binding_affinity`: Predict protein-ligand binding affinity using Boltz-2
  - Args:
    - `protein` (list): List of protein chains with sequence information
      - Each chain: `{'chain': str, 'sequence': str}`
    - `smiles_list` (list): List of ligand SMILES strings
  - Returns:
    - `boltz_res` (list): List of binding predictions
      - `smiles` (str): Ligand SMILES string
      - `affinity_probability` (float): Binding affinity probability (0-1)
      - `cif_file` (str): Path to predicted complex structure

### Input/Output

**Input:**
- `protein`: List of protein chains
  - `chain`: Chain identifier (e.g., 'A', 'B')
  - `sequence`: Amino acid sequence in single-letter code
- `smiles_list`: List of SMILES strings for ligand molecules

**Output:**
- List of binding predictions, each containing:
  - `smiles`: Ligand SMILES string
  - `affinity_probability`: Binding probability (0-1, higher is better)
  - `cif_file`: Path to predicted protein-ligand complex structure in CIF format

### Affinity Interpretation

- **Probability > 0.5**: Strong binding likelihood
- **Probability 0.3-0.5**: Moderate binding potential
- **Probability < 0.3**: Weak or no binding expected

### Use Cases

- Virtual screening of compound libraries
- Lead optimization in drug discovery
- Protein-ligand binding mode prediction
- Structure-based drug design
- Comparative binding analysis across ligands

### Performance Notes

- **Execution time**: 30-120 seconds per ligand depending on protein size
- **Protein length**: Best for proteins <1000 amino acids
- **Multiple ligands**: Processes sequentially, allow sufficient time
- **Structure output**: CIF files can be visualized in PyMOL, ChimeraX, or similar tools
