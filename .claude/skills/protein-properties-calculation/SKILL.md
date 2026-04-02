---
name: protein-properties-calculation
description: Calculate comprehensive protein sequence properties including isoelectric point, molecular weight, hydrophobicity, and physicochemical parameters.
license: MIT license
metadata:
    skill-author: PJLab
---

# Protein Properties Calculation

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

class BiologyToolsClient:
    """Biology Tools MCP Client using FastMCP"""

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

### 2. Protein Properties Calculation Workflow

This workflow calculates comprehensive physicochemical properties of protein sequences including molecular weight, isoelectric point, hydrophobicity, and other parameters useful for protein characterization.

**Workflow Steps:**

1. **Calculate Isoelectric Point and Molecular Weight** - Compute pI and MW
2. **Calculate Protein Parameters** - Compute amino acid composition, instability index, etc.
3. **Calculate Hydrophobicity** - Predict hydrophobic/hydrophilic regions

**Implementation:**

```python
## Initialize client
HEADERS = {"SCP-HUB-API-KEY": "<your-api-key>"}

client = BiologyToolsClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/29/SciToolAgent-Bio",
    HEADERS
)

if not await client.connect():
    print("connection failed")
    exit()

## Input: Protein sequence to analyze
protein_sequence = "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTLGQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWAGIKATEAAVSEEFGLAPFLPDQIHFVHSQELLSRYPDLDAKGRERAIAKDLGAVFLVGIGGKLSDGHRHDVRAPDYDDWSTPSELGHAGLNGDILVWNPVLEDAFELSSMGIRVDADTLKHQLALTGDEDRLELEWHQALLRGEMPQTIGGGIGQSRLTMLLLQLPHIGQVQAGVWPAAVRESVPSLL"

print("=== Protein Properties Calculation ===\n")

## Step 1: Calculate isoelectric point and molecular weight
print("Step 1: Isoelectric Point and Molecular Weight")
result = await client.client.call_tool(
    "ComputePiMw",
    arguments={"protein": protein_sequence}
)
result_data = client.parse_result(result)
print(f"{result_data}\n")

## Step 2: Calculate comprehensive protein parameters
print("Step 2: Protein Sequence Parameters")
result = await client.client.call_tool(
    "ComputeProtPara",
    arguments={"protein": protein_sequence}
)
result_data = client.parse_result(result)
print(f"{result_data}\n")

## Step 3: Calculate hydrophobicity scale
print("Step 3: Hydrophobicity Profile")
result = await client.client.call_tool(
    "ComputeProtScale",
    arguments={"protein": protein_sequence}
)
result_data = client.parse_result(result)
print(f"{result_data}\n")

## Step 4: Calculate extinction coefficient
print("Step 4: Extinction Coefficient")
result = await client.client.call_tool(
    "ComputeExtinctionCoefficient",
    arguments={"protein": protein_sequence}
)
result_data = client.parse_result(result)
print(f"{result_data}\n")

await client.disconnect()
```

### Tool Descriptions

**SciToolAgent-Bio Server:**
- `ComputePiMw`: Calculate protein isoelectric point and molecular weight
  - Args: `protein` (str) - Protein sequence
  - Returns: pI value and molecular weight in Daltons

- `ComputeProtPara`: Calculate comprehensive protein parameters
  - Args: `protein` (str) - Protein sequence
  - Returns: Amino acid composition, instability index, aliphatic index, GRAVY, etc.

- `ComputeProtScale`: Calculate hydrophobicity scale
  - Args: `protein` (str) - Protein sequence
  - Returns: Hydrophobicity values along the sequence

- `ComputeExtinctionCoefficient`: Calculate extinction coefficient at 280nm
  - Args: `protein` (str) - Protein sequence
  - Returns: Extinction coefficient for protein quantification

### Input/Output

**Input:**
- `protein`: Protein sequence in single-letter amino acid code

**Output:**
- **pI (Isoelectric Point)**: pH at which protein has no net charge
- **Molecular Weight**: Mass in Daltons (Da)
- **Amino Acid Composition**: Percentage of each amino acid
- **Instability Index**: Protein stability estimate (>40 = unstable)
- **Aliphatic Index**: Thermal stability indicator
- **GRAVY (Grand Average of Hydropathy)**: Overall hydrophobicity (-2 to +2)
- **Extinction Coefficient**: For protein concentration determination (M⁻¹cm⁻¹)

### Use Cases

- Predict protein behavior in different pH conditions
- Estimate protein molecular weight from sequence
- Assess protein stability and solubility
- Determine protein concentration spectrophotometrically
- Plan protein purification strategies
- Predict protein localization based on hydrophobicity
- Design expression and purification protocols

### Parameter Interpretation

- **pI < 7**: Acidic protein (negatively charged at physiological pH)
- **pI > 7**: Basic protein (positively charged at physiological pH)
- **Instability Index < 40**: Stable protein
- **Instability Index > 40**: Unstable protein (may degrade quickly)
- **GRAVY < 0**: Hydrophilic (soluble in water)
- **GRAVY > 0**: Hydrophobic (may be membrane protein or have stability issues)

### Additional Tools Available

The SciToolAgent-Bio server provides 50+ additional tools including:
- Codon optimization (`ProteinCodonOptimization`)
- Peptide weight calculation (`PeptideWeightCalculator`)
- Protein solubility prediction (`ProteinSolubilityPredictor`)
- Disordered region prediction (`InherentDisorderedRegionsPredictor`)
- Nuclear localization signal prediction (`ProteinNuclearLocalizationSequencePrediction`)
