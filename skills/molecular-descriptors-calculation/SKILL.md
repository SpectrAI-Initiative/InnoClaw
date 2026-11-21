---
name: molecular-descriptors-calculation
description: Calculate advanced molecular descriptors including shape indices, connectivity indices, and structural features for QSAR and drug discovery.
license: MIT license
metadata:
    skill-author: PJLab
---

# Molecular Descriptors Calculation

## Usage

### 1. MCP Server Definition

Use the same `ChemicalToolsClient` class as defined in the molecular-properties-calculation skill.

### 2. Molecular Descriptors Calculation Workflow

This workflow calculates advanced molecular descriptors used in QSAR modeling, drug discovery, and computational chemistry.

**Workflow Steps:**

1. **Calculate Kappa Shape Indices** - Molecular shape descriptors
2. **Calculate Connectivity Indices** - Topological descriptors
3. **Calculate Structural Features** - Rings, bonds, and functional groups

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
print(f"=== Molecular Descriptors for {smiles} ===\n")

## Step 1: Calculate Kappa shape indices
print("Step 1: Kappa Shape Indices")
for tool in ["GetKappa1", "GetKappa2", "GetKappa3"]:
    result = await client.client.call_tool(
        tool,
        arguments={"smiles": smiles}
    )
    result_data = client.parse_result(result)
    print(f"{tool}: {result_data}")
print()

## Step 2: Calculate Chi connectivity indices
print("Step 2: Chi Connectivity Indices")
for tool in ["GetChi0n", "GetChi0v", "GetChi1n", "GetChi1v"]:
    result = await client.client.call_tool(
        tool,
        arguments={"smiles": smiles}
    )
    result_data = client.parse_result(result)
    print(f"{tool}: {result_data}")
print()

## Step 3: Calculate structural features
print("Step 3: Structural Features")

# Rotatable bonds
result = await client.client.call_tool(
    "GetRotatableBondsNum",
    arguments={"smiles": smiles}
)
print(f"Rotatable bonds: {client.parse_result(result)}")

# Hydrogen bond donors and acceptors
result = await client.client.call_tool(
    "GetHBDNum",
    arguments={"smiles": smiles}
)
print(f"H-bond donors: {client.parse_result(result)}")

result = await client.client.call_tool(
    "GetHBANum",
    arguments={"smiles": smiles}
)
print(f"H-bond acceptors: {client.parse_result(result)}")

# Ring counts
result = await client.client.call_tool(
    "GetRingsNum",
    arguments={"smiles": smiles}
)
print(f"Number of rings: {client.parse_result(result)}")

result = await client.client.call_tool(
    "GetAromaticRingsNum",
    arguments={"smiles": smiles}
)
print(f"Aromatic rings: {client.parse_result(result)}")
print()

## Step 4: Calculate physicochemical descriptors
print("Step 4: Physicochemical Descriptors")

# LogP and molar refractivity (Crippen descriptors)
result = await client.client.call_tool(
    "GetCrippenDescriptors",
    arguments={"smiles": smiles}
)
print(f"Crippen descriptors (LogP, MR): {client.parse_result(result)}")

# Topological polar surface area
result = await client.client.call_tool(
    "CalculateTPSA",
    arguments={"smiles": smiles}
)
print(f"TPSA: {client.parse_result(result)}")

# Fraction of sp3 carbons
result = await client.client.call_tool(
    "GetFractionCSP3",
    arguments={"smiles": smiles}
)
print(f"Fraction sp3 carbons: {client.parse_result(result)}")
print()

await client.disconnect()
```

### Tool Descriptions

**SciToolAgent-Chem Server:**

**Shape Descriptors:**
- `GetKappa1`, `GetKappa2`, `GetKappa3`: Kappa shape indices (molecular shape)

**Connectivity Indices:**
- `GetChi0n`, `GetChi0v`: Zero-order chi indices
- `GetChi1n`, `GetChi1v`: First-order chi indices
- `GetChi2n`, `GetChi2v`: Second-order chi indices
- `GetChi3n`, `GetChi3v`, `GetChi4n`, `GetChi4v`: Higher-order chi indices

**Structural Features:**
- `GetRotatableBondsNum`: Count rotatable bonds (flexibility)
- `GetHBDNum`/`GetHBANum`: Hydrogen bond donors/acceptors
- `GetRingsNum`: Total ring count
- `GetAromaticRingsNum`: Aromatic ring count
- `GetAliphaticRingsNum`: Aliphatic ring count

**Physicochemical Descriptors:**
- `GetCrippenDescriptors`: LogP (lipophilicity) and molar refractivity
- `CalculateTPSA`: Topological polar surface area
- `GetFractionCSP3`: Fraction of sp³ hybridized carbons
- `GetLabuteASA`: Labute accessible surface area

### Input/Output

**Input:**
- `smiles`: Molecule in SMILES format

**Output:**
- **Kappa Indices**: Molecular shape descriptors (1, 2, 3)
- **Chi Indices**: Topological connectivity indices
- **Structural Counts**: Rings, bonds, functional groups
- **LogP**: Lipophilicity (partition coefficient)
- **TPSA**: Topological polar surface area (Ų)
- **Fraction sp³**: Proportion of sp³ carbons (0-1)

### Descriptor Applications

**Kappa Shape Indices**
- κ₁, κ₂, κ₃: Describe molecular shape from linear to spherical
- Used in: QSAR models, molecular shape comparison

**Chi Connectivity Indices**
- Encode information about branching and cyclicity
- Used in: Property prediction, similarity searching

**Structural Features**
- **Rotatable bonds**: Molecular flexibility, bioavailability
- **H-bond donors/acceptors**: Solubility, permeability
- **Rings**: Rigidity, drug-likeness

**Physicochemical Descriptors**
- **LogP**: Lipophilicity, membrane permeability
- **TPSA**: Oral bioavailability, BBB penetration
- **Fraction sp³**: Molecular complexity, drug-likeness

### Drug-Likeness Rules

**Lipinski's Rule of Five:**
- MW ≤ 500 Da
- LogP ≤ 5
- HBD ≤ 5
- HBA ≤ 10

**Veber's Rules (Oral Bioavailability):**
- Rotatable bonds ≤ 10
- TPSA ≤ 140 Ų

**CNS Drug-Likeness:**
- TPSA < 90 Ų (for blood-brain barrier penetration)

### Use Cases

- QSAR model development
- Virtual screening and compound prioritization
- Drug-likeness assessment
- Molecular similarity calculations
- Pharmacokinetic property prediction
- Lead optimization
- Chemical space exploration

### Additional Descriptor Tools

The SciToolAgent-Chem server provides 160+ tools including:
- `GetBCUT`: BCUT descriptors
- `GetAutocorrelation2D`/`GetAutocorrelation3D`: Autocorrelation descriptors
- `GetWHIM`: WHIM descriptors
- `GetGETAWAY`: GETAWAY descriptors
- `GetMORSE`: MORSE descriptors
- `GetRDF`: Radial distribution function
- `GetUSR`/`GetUSRCAT`: Ultrafast shape recognition descriptors

### Performance Notes

- Most descriptor calculations are very fast (<1 second)
- Can batch process multiple molecules
- Descriptors are deterministic (same molecule → same descriptors)
