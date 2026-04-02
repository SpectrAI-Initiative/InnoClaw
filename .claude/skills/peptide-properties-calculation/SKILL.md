---
name: peptide-properties-calculation
description: Calculate peptide sequence properties including molecular weight, isoelectric point, extinction coefficient, and chemical formula.
license: MIT license
metadata:
    skill-author: PJLab
---

# Peptide Properties Calculation

## Usage

### 1. MCP Server Definition

Use the same `BiologyToolsClient` class as defined in the protein-properties-calculation skill.

### 2. Peptide Properties Calculation Workflow

This workflow calculates comprehensive physicochemical properties of peptide sequences for peptide drug design, synthesis planning, and characterization.

**Workflow Steps:**

1. **Calculate Peptide Properties** - Compute MW, pI, extinction coefficient, GRAVY, and chemical formula
2. **Analyze Multiple Peptides** - Compare properties across different sequences

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

print("=== Peptide Properties Calculation ===\n")

## Input: Peptide sequences to analyze
peptides = [
    ("All 20 amino acids", "ACDEFGHIKLMNPQRSTVWY"),
    ("Glycine repeat", "GGGGG"),
    ("Arginine repeat (positively charged)", "RRRRR"),
]

## Calculate properties for each peptide
for name, peptide in peptides:
    print(f"--- {name}: {peptide} ---")

    # Calculate peptide properties
    result = await client.client.call_tool(
        "CalculatorPeptideProperty",
        arguments={
            "sq": peptide,
            "aaCode": "0",          # Use single-letter code
            "nTerm": "",            # N-terminal modification (if any)
            "cTerm": "",            # C-terminal modification (if any)
            "disulphideBonds": ""   # Disulfide bonds (if any)
        }
    )
    result_data = client.parse_result(result)
    print(f"{result_data}\n")

## Additional analysis: Peptide weight calculation
print("=== Peptide Weight Calculation (Alternative Method) ===\n")
test_peptide = "ACDEFGHIKLMNPQRSTVWY"

result = await client.client.call_tool(
    "PeptideWeightCalculator",
    arguments={"sequence": test_peptide}
)
result_data = client.parse_result(result)
print(f"Peptide: {test_peptide}")
print(f"{result_data}\n")

## Additional analysis: Peptide formula calculation
print("=== Peptide Chemical Formula ===\n")

result = await client.client.call_tool(
    "PeptideFormulaCalculator",
    arguments={"sequence": test_peptide}
)
result_data = client.parse_result(result)
print(f"Peptide: {test_peptide}")
print(f"{result_data}\n")

await client.disconnect()
```

### Tool Descriptions

**SciToolAgent-Bio Server:**
- `CalculatorPeptideProperty`: Calculate comprehensive peptide properties
  - Args:
    - `sq` (str): Peptide sequence (single or three-letter code)
    - `aaCode` (str): "0" for single-letter, "1" for three-letter code
    - `nTerm` (str): N-terminal modification (e.g., "Acetyl", "")
    - `cTerm` (str): C-terminal modification (e.g., "Amide", "")
    - `disulphideBonds` (str): Disulfide bonds specification
  - Returns: MW, extinction coefficient, pI, GRAVY, chemical formula, sequence length

- `PeptideWeightCalculator`: Calculate peptide molecular weight
  - Args: `sequence` (str) - Peptide sequence
  - Returns: Molecular weight in Daltons

- `PeptideFormulaCalculator`: Calculate peptide chemical formula
  - Args: `sequence` (str) - Peptide sequence
  - Returns: Molecular formula (e.g., C₁₀₇H₁₅₉N₂₉O₃₀S₂)

### Input/Output

**Input:**
- `sq`: Peptide sequence in single-letter (ACDEFG...) or three-letter (Ala-Cys-Asp...) code
- `aaCode`: "0" for single-letter code, "1" for three-letter code
- `nTerm`: Optional N-terminal modification
- `cTerm`: Optional C-terminal modification
- `disulphideBonds`: Optional disulfide bond specification

**Output:**
- **Average Molecular Weight**: Mass in g/mol or Daltons
- **Extinction Coefficient**: For peptide quantification at 280nm (M⁻¹cm⁻¹)
- **Theoretical Isoelectric Point (pI)**: pH at which peptide has no net charge
- **GRAVY (Grand Average of Hydropathy)**: Hydrophobicity index
- **Chemical Formula**: Elemental composition (C, H, N, O, S)
- **Sequence Length**: Number of amino acid residues
- **Three-letter Representation**: Full peptide notation

### Use Cases

- Design peptide drugs and therapeutics
- Plan peptide synthesis strategies
- Calculate peptide concentrations spectrophotometrically
- Predict peptide solubility and stability
- Optimize peptide purification conditions
- Design peptide-based biosensors
- Analyze peptide fragments from mass spectrometry

### Terminal Modifications

Common N-terminal modifications:
- **Acetyl**: Blocks N-terminus, increases stability
- **Formyl**: Common in bacterial proteins
- **None**: Free amine group (default)

Common C-terminal modifications:
- **Amide**: Blocks C-terminus, increases stability
- **None**: Free carboxyl group (default)

Example with modifications:
```python
result = await client.client.call_tool(
    "CalculatorPeptideProperty",
    arguments={
        "sq": "ACDEFG",
        "aaCode": "0",
        "nTerm": "Acetyl",
        "cTerm": "Amide",
        "disulphideBonds": ""
    }
)
```

### GRAVY Interpretation

- **GRAVY < -0.5**: Very hydrophilic (highly soluble)
- **GRAVY -0.5 to 0**: Hydrophilic (soluble)
- **GRAVY 0 to +0.5**: Hydrophobic (may have solubility issues)
- **GRAVY > +0.5**: Very hydrophobic (likely membrane-associated or poorly soluble)

### Extinction Coefficient Usage

Calculate peptide concentration:
```
Concentration (M) = Absorbance at 280nm / (Extinction Coefficient × Path Length)
```

Where path length is typically 1 cm for standard cuvettes.

**Note**: Extinction coefficient is primarily determined by Trp (5500), Tyr (1490), and Cys-Cys (125) residues.

### Additional Peptide Tools Available

- `ConvertingPeptide2SMILES`: Convert peptide sequence to SMILES notation
- `ProteinIsoelectricPointCalculator`: Calculate pI for longer sequences
- `ComputeAffinity`: Predict peptide-protein binding affinity
- `OverlapPeptideLibraryDesign`: Design peptide libraries
- `AlanineScanningLibraryDesign`: Design mutagenesis libraries
- `TruncationLibraryDesign`: Design truncation variants
