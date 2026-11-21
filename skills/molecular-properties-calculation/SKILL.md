---
name: molecular-properties-calculation
description: Calculate basic molecular properties from SMILES including molecular weight, formula, atom counts, and exact mass.
license: MIT license
metadata:
    skill-author: PJLab
---

# Molecular Properties Calculation

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

class ChemicalToolsClient:
    """Chemical Tools MCP Client using FastMCP"""

    def __init__(self, server_url: str, headers: dict = None):
        self.server_url = server_url
        self.headers = headers or {}
        self.client = None

    async def connect(self):
        """Establish connection and initialize session"""
        print(f"Connecting to: {self.server_url}")
        try:
            transport = StreamableHttpTransport(
                url=self.server_url,
                headers=self.headers
            )

            self._stack = AsyncExitStack()
            await self._stack.__aenter__()
            self.client = Client(transport)
            await self._stack.enter_async_context(self.client)

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
                    try:
                        return json.loads(content.text)
                    except:
                        return content.text
            return str(result)
        except Exception as e:
            return {"error": f"parse error: {e}", "raw": str(result)}
```

### 2. Molecular Properties Calculation Workflow

This workflow calculates fundamental molecular properties from SMILES strings, useful for drug discovery, chemical analysis, and computational chemistry.

**Workflow Steps:**

1. **Calculate Molecular Weight** - Compute average molecular weight
2. **Calculate Molecular Formula** - Determine elemental composition
3. **Calculate Exact Molecular Weight** - Compute monoisotopic mass
4. **Count Atoms** - Determine total and heavy atom counts

**Implementation:**

```python
## Initialize client
HEADERS = {"SCP-HUB-API-KEY": "<your-api-key>"}

client = ChemicalToolsClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/31/SciToolAgent-Chem",
    HEADERS
)

if not await client.connect():
    print("connection failed")
    exit()

## Input: SMILES string to analyze
smiles = "CCO"  # Ethanol
print(f"=== Molecular Properties for {smiles} ===\n")

## Step 1: Calculate molecular weight
print("Step 1: Molecular Weight")
result = await client.client.call_tool(
    "SMILESToWeight",
    arguments={"smiles": smiles}
)
result_data = client.parse_result(result)
print(f"{result_data}\n")

## Step 2: Calculate molecular formula
print("Step 2: Molecular Formula")
result = await client.client.call_tool(
    "GetMolFormula",
    arguments={"smiles": smiles}
)
result_data = client.parse_result(result)
print(f"{result_data}\n")

## Step 3: Calculate exact molecular weight
print("Step 3: Exact Molecular Weight")
result = await client.client.call_tool(
    "GetExactMolceularWeight",
    arguments={"smiles": smiles}
)
result_data = client.parse_result(result)
print(f"{result_data}\n")

## Step 4: Count atoms
print("Step 4: Atom Count")
result = await client.client.call_tool(
    "GetAtomsNum",
    arguments={"smiles": smiles}
)
result_data = client.parse_result(result)
print(f"{result_data}\n")

## Step 5: Count heavy atoms
print("Step 5: Heavy Atom Count")
result = await client.client.call_tool(
    "GetHeavyAtomsNum",
    arguments={"smiles": smiles}
)
result_data = client.parse_result(result)
print(f"{result_data}\n")

await client.disconnect()
```

### Tool Descriptions

**SciToolAgent-Chem Server:**
- `SMILESToWeight`: Calculate average molecular weight
  - Args: `smiles` (str) - SMILES string
  - Returns: Molecular weight in g/mol

- `GetMolFormula`: Calculate molecular formula
  - Args: `smiles` (str) - SMILES string
  - Returns: Molecular formula (e.g., C₂H₆O)

- `GetExactMolceularWeight`: Calculate exact (monoisotopic) molecular weight
  - Args: `smiles` (str) - SMILES string
  - Returns: Exact mass (most abundant isotope composition)

- `GetAtomsNum`: Count total number of atoms
  - Args: `smiles` (str) - SMILES string
  - Returns: Total atom count (excluding hydrogens in implicit SMILES)

- `GetHeavyAtomsNum`: Count heavy atoms (non-hydrogen)
  - Args: `smiles` (str) - SMILES string
  - Returns: Heavy atom count

### Input/Output

**Input:**
- `smiles`: Molecule in SMILES format (e.g., "CCO", "c1ccccc1", "CC(=O)O")

**Output:**
- **Molecular Weight**: Average mass based on natural isotope abundances (g/mol or Da)
- **Molecular Formula**: Elemental composition (CₓHᵧNᵢOⱼ...)
- **Exact Molecular Weight**: Monoisotopic mass (most abundant isotope for each element)
- **Atom Count**: Total number of atoms in the molecule
- **Heavy Atom Count**: Number of non-hydrogen atoms

### Use Cases

- Drug-likeness assessment (molecular weight screening)
- Mass spectrometry data interpretation
- Stoichiometry calculations
- Chemical database queries
- Lipinski's Rule of Five evaluation
- Compound library characterization
- Quality control for chemical synthesis

### Molecular Weight Types

- **Average MW**: Used for general calculations, based on natural isotope distribution
- **Exact MW**: Used for mass spectrometry, based on most abundant isotopes
- **Difference**: Minimal for small molecules, can be significant for large biomolecules

Example:
- Ethanol (C₂H₆O): Average MW = 46.07 Da, Exact MW = 46.0418 Da

### Additional Molecular Property Tools

The SciToolAgent-Chem server provides 160+ additional tools including:
- `GetRotatableBondsNum`: Count rotatable bonds
- `GetHBDNum`/`GetHBANum`: Hydrogen bond donors/acceptors
- `GetRingsNum`: Count ring systems
- `GetTPSA`: Calculate topological polar surface area (TPSA)
- `GetCrippenDescriptors`: Calculate logP and molar refractivity
- `GetLipinskiHBDNum`/`GetLipinskiHBANum`: Lipinski rule parameters
- `GetAromaticRingsNum`: Count aromatic rings
- `GetFractionCSP3`: Calculate fraction of sp³ carbons

### Lipinski's Rule of Five

For drug-likeness, molecules should satisfy:
1. Molecular weight ≤ 500 Da
2. LogP ≤ 5
3. Hydrogen bond donors ≤ 5
4. Hydrogen bond acceptors ≤ 10

Use the property calculation tools to assess these criteria.
