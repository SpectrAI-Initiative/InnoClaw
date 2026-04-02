---
name: drug-screening-docking
description: Comprehensive drug screening pipeline from molecular filtering through QED/ADMET criteria to protein-ligand docking, identifying promising drug candidates.
license: MIT license
metadata:
    skill-author: PJLab
---

# Drug Screening and Molecular Docking Workflow

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
                headers={"SCP-HUB-API-KEY": "<your-api-key>"}
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

### 2. Drug Screening and Docking Workflow

This workflow screens candidate molecules using drug-likeness and ADMET criteria, then performs molecular docking with a target protein to identify promising drug candidates.

**Workflow Steps:**

1. **Calculate QED Scores** - Assess drug-likeness using Quantitative Estimate of Drug-likeness
2. **Predict ADMET Properties** - Calculate LD50 toxicity prediction
3. **Filter Molecules** - Apply criteria (QED ≥ 0.6 and LD50 ≥ 3.0)
4. **Retrieve Protein Structure** - Download target protein from RCSB PDB
5. **Extract Main Chain** - Isolate primary protein chain
6. **Fix Protein Structure** - Repair PDB file using PDBFixer
7. **Identify Binding Pocket** - Locate binding site using Fpocket
8. **Convert Ligand Format** - Convert SMILES to PDBQT format
9. **Convert Protein Format** - Convert protein PDB to PDBQT
10. **Perform Molecular Docking** - Dock ligands and calculate binding affinity
11. **Filter by Affinity** - Select molecules with affinity ≤ -7.0 kcal/mol

**Implementation:**

```python
## Initialize clients for both Tool and Model servers
tool_client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
model_client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model")

if not await tool_client.connect() or not await model_client.connect():
    print("connection failed")
    return

## Input: List of candidate SMILES strings
smiles_list = ['O=C(Nc1cccc2c1CCCC2)N1CCc2c([nH]c3ccccc23)C1c1cccc(F)c1F', ...]

## Step 1: Calculate QED scores
result = await tool_client.session.call_tool(
    "calculate_mol_drug_chemistry",
    arguments={"smiles_list": smiles_list}
)
QED_result = tool_client.parse_result(result)["metrics"]

## Step 2: Predict ADMET properties (LD50)
result = await model_client.session.call_tool(
    "pred_molecule_admet",
    arguments={"smiles_list": smiles_list}
)
LD50_result = model_client.parse_result(result)["admet_preds"]

## Step 3: Filter molecules by QED and LD50 criteria
select_smiles_list = []
for i in range(len(smiles_list)):
    QED = QED_result[i]["qed"]
    LD50 = LD50_result[i]["LD50_Zhu"]
    if QED >= 0.6 and LD50 >= 3.0:
        select_smiles_list.append(smiles_list[i])

## Step 4: Retrieve protein structure by PDB code
pdb_code = "6vkv"
result = await tool_client.session.call_tool(
    "retrieve_protein_data_by_pdbcode",
    arguments={"pdb_code": pdb_code}
)
pdb_path = tool_client.parse_result(result)["pdb_path"]

## Step 5: Extract main chain
result = await tool_client.session.call_tool(
    "save_main_chain_pdb",
    arguments={"pdb_file": pdb_path, "main_chain_id": ""}
)
pdb_path = tool_client.parse_result(result)["out_file"]

## Step 6: Fix PDB file for docking
result = await tool_client.session.call_tool(
    "fix_pdb_dock",
    arguments={"pdb_file_path": pdb_path}
)
pdb_path = tool_client.parse_result(result)["fix_pdb_file_path"]

## Step 7: Identify binding pocket
result = await model_client.session.call_tool(
    "run_fpocket",
    arguments={"pdb_path": pdb_path}
)
best_pocket = tool_client.parse_result(result)["pockets"][0]

## Step 8: Convert SMILES to PDBQT format
result = await tool_client.session.call_tool(
    "convert_smiles_to_other_format",
    arguments={"inputs": select_smiles_list, "target_format": "pdbqt"}
)
ligand_paths = [x["output_file"] for x in tool_client.parse_result(result)["convert_results"]]

## Step 9: Convert protein PDB to PDBQT
result = await tool_client.session.call_tool(
    "convert_pdb_to_pdbqt_dock",
    arguments={"input_pdb_path": pdb_path}
)
receptor_path = tool_client.parse_result(result)["output_file"]

## Step 10: Perform molecular docking
result = await model_client.session.call_tool(
    "quick_molecule_docking",
    arguments={
        "receptor_path": receptor_path,
        "ligand_paths": ligand_paths,
        "center_x": best_pocket["center_x"],
        "center_y": best_pocket["center_y"],
        "center_z": best_pocket["center_z"],
        "size_x": best_pocket["size_x"],
        "size_y": best_pocket["size_y"],
        "size_z": best_pocket["size_z"]
    }
)
docking_results = model_client.parse_result(result)["docking_results"]

## Step 11: Filter by binding affinity
final_smiles_list = []
for item in docking_results:
    if item['affinity'] <= -7.0:
        final_smiles_list.append(select_smiles_list[item['index']])

print(f"Final candidates: {final_smiles_list}")

await tool_client.disconnect()
await model_client.disconnect()
```

### Tool Descriptions

**DrugSDA-Tool Server Tools:**
- `calculate_mol_drug_chemistry`: Compute QED score and Lipinski's Rule of Five violations
- `retrieve_protein_data_by_pdbcode`: Download protein structure from RCSB PDB
- `save_main_chain_pdb`: Extract main protein chain
- `fix_pdb_dock`: Repair PDB file using PDBFixer
- `convert_smiles_to_other_format`: Convert SMILES to various formats (PDBQT, SDF, etc.)
- `convert_pdb_to_pdbqt_dock`: Convert PDB to PDBQT format for docking

**DrugSDA-Model Server Tools:**
- `pred_molecule_admet`: Predict ADMET properties including LD50 toxicity
- `run_fpocket`: Identify protein binding pockets
- `quick_molecule_docking`: Perform AutoDock Vina molecular docking

### Input/Output

**Input:**
- `smiles_list`: List of SMILES strings representing candidate molecules
- `pdb_code`: PDB code of target protein structure

**Output:**
- `final_smiles_list`: SMILES strings of molecules with QED ≥ 0.6, LD50 ≥ 3.0, and binding affinity ≤ -7.0 kcal/mol

### Filtering Criteria

- **QED Threshold**: ≥ 0.6 (drug-likeness)
- **LD50 Threshold**: ≥ 3.0 (toxicity)
- **Affinity Threshold**: ≤ -7.0 kcal/mol (binding strength)

Adjust these thresholds based on your specific requirements.
