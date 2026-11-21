---
name: drugsda-mol-properties
description: Calculate different types of molecular properties based on SMILES strings, covering basic physicochemical properties, hydrophobicity, hydrogen bonding capability, molecular complexity, topological structures, charge distribution, and custom complexity metrics, respectively. 
license: MIT license
metadata:
    skill-author: PJLab
---

# Molecular Properties Calculation

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

Tool 1: *calculate_mol_basic_info*

```tex
Compute a set of basic molecular properties for each SMILES.
Args:
    smiles_list (List[str]): List of input SMILES strings, (e.g., ["N[C@@H](Cc1ccc(O)cc1)C(=O)O", "CC(C)C1=CC=CC=C1"])
Return:
    status (str): success/error
    msg (str): message
    metrics (List[dict]): List of dict, each containing feature keys.
        --smiles (str): A SMILES string of smiles_list
        --molecular_formula (str): Molecular formula, e.g. "C9H11NO3"
        --exact_molecular_weight (float): Exact molecular weight
        --molecular_weight (float): Average molecular weight
        --num_heavy_atoms (int): Number of heavy atoms
        --num_atoms (int): Number of total atoms
        --num_bonds (int): Number of bonds
        --num_valence_electrons (int): Number of valence electrons
        --formal_charge (int): Number of formal charge
```

Tool 2: calculate_mol_hydrophobicity

```tex
Compute hydrophobicity-related molecular descriptors for each SMILES.
Args:
    smiles_list (List[str]): List of input SMILES strings, (e.g., ["N[C@@H](Cc1ccc(O)cc1)C(=O)O", "CC(C)C1=CC=CC=C1"])
Return:
    status (str): success/error
    msg (str): message
    metrics (List[dict]): List of dict, each containing feature keys.
        --smiles (str): A SMILES string of smiles_list
        --logp (float): The octanol-water partition coefficient (logP)
        --molar_refractivity (float): Molar refractivity
```

Tool 3: calculate_mol_hbond

```tex
Compute hydrogen bonding-related properties for each SMILES.
Args:
    smiles_list (List[str]): List of input SMILES strings, (e.g., ["N[C@@H](Cc1ccc(O)cc1)C(=O)O", "CC(C)C1=CC=CC=C1"])
Return:
    status (str): success/error
    msg (str): message
    metrics (List[dict]): List of dict, each containing several feature keys.
        --smiles (str): A SMILES string of smiles_list
        --num_h_donors (int): Number of hydrogen bond donors
        --num_h_acceptors (int): Number of hydrogen bond acceptors
```

Tool 4: calculate_mol_structure_complexity

```tex
Compute a set of molecular complexity descriptors for each SMILES.
Args:
    smiles_list (List[str]): List of input SMILES strings, (e.g., ["N[C@@H](Cc1ccc(O)cc1)C(=O)O", "CC(C)C1=CC=CC=C1"])
Return:
    status (str): success/error
    msg (str): message
    metrics (List[dict]): List of dict, each containing feature keys.
        --smiles (str): A SMILES string of smiles_list
        --num_rotatable_bonds (int): Number of rotatable bonds
        --num_rings (int): Number of total rings
        --num_aromatic_rings (int): Number of aromatic rings
        --num_aliphatic_rings (int): Number of aliphatic rings
        --num_saturated_rings (int): Number of saturated rings
        --num_heteroatoms (int): Number of heteroatoms
        --fraction_csp3 (float): The fraction of sp³-hybridized carbon atoms (Fsp³)
        --num_bridgehead_atoms (int): Number of bridgehead atoms
```

Tool 5: calculate_mol_topology

```tex
Compute a set of topological descriptors for each SMILES.
Args:
    smiles_list (List[str]): List of input SMILES strings, (e.g., ["N[C@@H](Cc1ccc(O)cc1)C(=O)O", "CC(C)C1=CC=CC=C1"])
Return:
    status (str): success/error
    msg (str): message
    metrics (List[dict]): List of dict, each containing several feature keys.
        --smiles (str): A SMILES string of smiles_list
        --tpsa (float): Topological polar surface area
        --chi0v (float): Non-valence molecular connectivity index
        --chi1v (float): Non-valence molecular connectivity index
        --chi2v (float): Non-valence molecular connectivity index
        --chi3v (float): Non-valence molecular connectivity index
        --chi4v (float): Non-valence molecular connectivity index
        --chi0n (float): Non-valence molecular connectivity index
        --chi1n (float): Non-valence molecular connectivity index
        --chi2n (float): Non-valence molecular connectivity index
        --chi3n (float): Non-valence molecular connectivity index
        --chi4n (float): Non-valence molecular connectivity index
        --hall_kier_alpha (float): Hall–Kier alpha value
        --kappa1 (float): Kappa shape index
        --kappa2 (float): Kappa shape index
        --kappa3 (float): Kappa shape index
```

Tool 6: calculate_mol_charge

```tex
Compute Gasteiger partial charges and formal charge for each SMILES.
Args:
    smiles_list (List[str]): List of input SMILES strings, (e.g., ["N[C@@H](Cc1ccc(O)cc1)C(=O)O", "CC(C)C1=CC=CC=C1"])
Return:
    status (str): success/error
    msg (str): message
    metrics (List[dict]): List of dict, each containing several feature keys.
        --smiles (str): A SMILES string of smiles_list
        --min_gasteiger_charge (float): Minimum of Gasteiger charges
        --max_gasteiger_charge (float): Maximum of Gasteiger charges
        --avg_gasteiger_charge (float): Average of Gasteiger charges
        --gasteiger_charge_range (float): Range of Gasteiger charges
        --formal_charge (int): Formal charge
```

Tool 7: calculate_mol_complexity

```tex
Compute custom molecular complexity-related descriptors for each SMILES.
Args:
    smiles_list (List[str]): List of input SMILES strings, (e.g., ["N[C@@H](Cc1ccc(O)cc1)C(=O)O", "CC(C)C1=CC=CC=C1"])
Return:
    status (str): success/error
    msg (str): message
    metrics (List[dict]): List of dict, each containing feature keys.
        --smiles (str): A SMILES string of smiles_list
        --molecular_complexity (int): Molecular complexity
        --aromatic_proportion (float): Aromatic proportion 
        --asphericity (float): Asphericity
```

### 3. Example Code

How to use these tools:

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

## The tool can be replaced with another based on actual requirements.
response = await client.session.call_tool(
    "calculate_mol_basic_info",			
    arguments={
        "smiles_list": smiles_list
    }
)
result = client.parse_result(response)
metrics = result["metrics"]

await client.disconnect() 
```

