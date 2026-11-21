---
name: molecular-format-conversion
description: Convert between molecular formats including SMILES, InChI, InChIKey, and SELFIES for cheminformatics applications.
license: MIT license
metadata:
    skill-author: PJLab
---

# Molecular Format Conversion

## Usage

### 1. MCP Server Definition

Use the same `ChemicalToolsClient` class as defined in the molecular-properties-calculation skill.

### 2. Molecular Format Conversion Workflow

This workflow converts molecules between different chemical formats (SMILES, InChI, SELFIES) for database searching, machine learning, and cheminformatics applications.

**Workflow Steps:**

1. **SMILES to InChI** - Convert SMILES to International Chemical Identifier
2. **InChI to SMILES** - Convert InChI back to SMILES
3. **SMILES to SELFIES** - Convert to string-based molecular representation

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

print("=== Molecular Format Conversion ===\n")

## Test molecules
smiles = "CCO"  # Ethanol
inchi = "InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3"

## Step 1: SMILES to InChI
print("Step 1: SMILES to InChI")
result = await client.client.call_tool(
    "SMILESToInChI",
    arguments={"smiles": smiles}
)
result_data = client.parse_result(result)
print(f"SMILES: {smiles}")
print(f"{result_data}\n")

## Step 2: InChI to SMILES
print("Step 2: InChI to SMILES")
result = await client.client.call_tool(
    "InChIToSMILES",
    arguments={"inchi": inchi}
)
result_data = client.parse_result(result)
print(f"InChI: {inchi}")
print(f"{result_data}\n")

## Step 3: SMILES to SELFIES
print("Step 3: SMILES to SELFIES")
result = await client.client.call_tool(
    "SMILEStoSELFIES",
    arguments={"smiles": smiles}
)
result_data = client.parse_result(result)
print(f"SMILES: {smiles}")
print(f"{result_data}\n")

## Step 4: SELFIES to SMILES
print("Step 4: SELFIES to SMILES")
selfies = "[C][C][O]"
result = await client.client.call_tool(
    "SELFIEStoSMILES",
    arguments={"selfies": selfies}
)
result_data = client.parse_result(result)
print(f"SELFIES: {selfies}")
print(f"{result_data}\n")

await client.disconnect()
```

### Tool Descriptions

**SciToolAgent-Chem Server:**
- `SMILESToInChI`: Convert SMILES to InChI
  - Args: `smiles` (str)
  - Returns: InChI string

- `InChIToSMILES`: Convert InChI to SMILES
  - Args: `inchi` (str)
  - Returns: SMILES string

- `SMILEStoSELFIES`: Convert SMILES to SELFIES
  - Args: `smiles` (str)
  - Returns: SELFIES string

- `SELFIEStoSMILES`: Convert SELFIES to SMILES
  - Args: `selfies` (str)
  - Returns: SMILES string

- `InChIToInChIKey`: Convert InChI to InChIKey
  - Args: `inchi` (str)
  - Returns: InChIKey (27-character hash)

- `InChIKeyToInChI`: Convert InChIKey to InChI
  - Args: `inchikey` (str)
  - Returns: InChI string

### Input/Output

**Input:**
- **SMILES**: Simplified Molecular Input Line Entry System (e.g., "CCO")
- **InChI**: IUPAC International Chemical Identifier (e.g., "InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3")
- **InChIKey**: Hashed InChI (27 characters, e.g., "LFQSCWFLJHTTHZ-UHFFFAOYSA-N")
- **SELFIES**: Self-Referencing Embedded Strings (e.g., "[C][C][O]")

**Output:**
- Converted molecular representation in target format

### Format Comparison

| Format | Canonical | Human-Readable | Database-Friendly | ML-Friendly |
|--------|-----------|----------------|-------------------|-------------|
| SMILES | Partial | High | Medium | Medium |
| InChI | Yes | Low | High | Low |
| InChIKey | Yes | No | Very High | No |
| SELFIES | Yes | Low | Low | Very High |

### Use Cases

- **SMILES**: Standard format for most cheminformatics tools
- **InChI**: Canonical representation for database searching
- **InChIKey**: Fast database lookups and duplicate detection
- **SELFIES**: Machine learning models (guarantees valid molecules)

### Format Details

**SMILES (Simplified Molecular Input Line Entry System)**
- Pros: Human-readable, widely supported
- Cons: Not canonical (multiple SMILES for same molecule)
- Example: "CCO", "c1ccccc1", "CC(=O)O"

**InChI (International Chemical Identifier)**
- Pros: Canonical, includes stereochemistry and isotopes
- Cons: Long, not human-readable
- Example: "InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3"

**InChIKey**
- Pros: Fixed-length hash, fast comparison
- Cons: Cannot reconstruct molecule from key
- Example: "LFQSCWFLJHTTHZ-UHFFFAOYSA-N"
- Structure: 14 characters (connectivity) + separator + 8 characters (stereo) + separator + version

**SELFIES (Self-Referencing Embedded Strings)**
- Pros: Always generates valid molecules, ideal for ML
- Cons: Less human-readable, newer format
- Example: "[C][C][O]"
- Used in: Generative models, molecular optimization

### Additional Conversion Tools

- `ConvertSmilesToInchi`: Alternative SMILES to InChI converter
- `GenerateMolKeyFromSmiles`: Generate molecular key
- `InChIKeyToMOL`: Convert InChIKey to MOL file
- `IsValidInChIKey`: Validate InChIKey format

### Error Handling

Some conversions may fail for:
- Invalid input formats
- Unsupported chemical features
- Very large or complex molecules

Always check for errors in the returned data.
