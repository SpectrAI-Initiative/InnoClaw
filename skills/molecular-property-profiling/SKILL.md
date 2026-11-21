---
name: molecular-property-profiling
description: Comprehensive molecular property analysis covering basic info, hydrophobicity, H-bonding, structural complexity, topology, drug-likeness, charge distribution, and complexity metrics.
license: MIT license
metadata:
    skill-author: PJLab
---

# Molecular Property Profiling Workflow

## Usage

### 1. MCP Server Definition

Use the same `DrugSDAClient` class as defined in previous skills.

### 2. Comprehensive Molecular Property Analysis

This workflow computes a comprehensive set of molecular descriptors across 8 different categories, providing a complete molecular profile for QSAR modeling, drug discovery, and molecular analysis.

**Workflow Steps:**

1. **Basic Properties** - Molecular formula, weight, atom counts, bond counts
2. **Hydrophobicity** - LogP, molar refractivity, lipophilicity descriptors
3. **Hydrogen Bonding** - H-bond donors/acceptors, TPSA
4. **Structural Complexity** - Ring counts, aromatic rings, rotatable bonds
5. **Topological Descriptors** - Chi indices, Kappa shape indices
6. **Drug Chemistry** - QED score, Lipinski violations
7. **Charge Properties** - Gasteiger charges, formal charge
8. **Complexity Metrics** - Molecular complexity, asphericity

**Implementation:**

```python
from collections import defaultdict

def merge_lists_by_smiles(*lists):
    """Merge multiple descriptor lists by SMILES key"""
    merged = defaultdict(dict)
    for lst in lists:
        for d in lst:
            smiles = d['smiles']
            merged[smiles].update(d)
    return list(merged.values())

client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
if not await client.connect():
    print("connection failed")
    return

## Input: List of SMILES strings
smiles_list = [
    'Nc1nnc(S(=O)(=O)NCCc2ccc(O)cc2)s1',
    'COc1ccc2c(=O)cc(C(=O)N3CCN(c4ccc(F)cc4)CC3)oc2c1',
    'CCCC1CCC(CC(=O)Cl)(C2CCCCC2)CC1'
]

## Step 1: Calculate basic molecular properties
result = await client.session.call_tool(
    "calculate_mol_basic_info",
    arguments={"smiles_list": smiles_list}
)
basic_metrics = client.parse_result(result)['metrics']

## Step 2: Calculate hydrophobicity descriptors
result = await client.session.call_tool(
    "calculate_mol_hydrophobicity",
    arguments={"smiles_list": smiles_list}
)
hydrophobicity_metrics = client.parse_result(result)['metrics']

## Step 3: Calculate hydrogen bonding properties
result = await client.session.call_tool(
    "calculate_mol_hbond",
    arguments={"smiles_list": smiles_list}
)
hbond_metrics = client.parse_result(result)['metrics']

## Step 4: Calculate structural complexity
result = await client.session.call_tool(
    "calculate_mol_structure_complexity",
    arguments={"smiles_list": smiles_list}
)
structure_metrics = client.parse_result(result)['metrics']

## Step 5: Calculate topological descriptors
result = await client.session.call_tool(
    "calculate_mol_topology",
    arguments={"smiles_list": smiles_list}
)
topology_metrics = client.parse_result(result)['metrics']

## Step 6: Calculate drug chemistry properties
result = await client.session.call_tool(
    "calculate_mol_drug_chemistry",
    arguments={"smiles_list": smiles_list}
)
chemistry_metrics = client.parse_result(result)['metrics']

## Step 7: Calculate charge properties
result = await client.session.call_tool(
    "calculate_mol_charge",
    arguments={"smiles_list": smiles_list}
)
charge_metrics = client.parse_result(result)['metrics']

## Step 8: Calculate complexity metrics
result = await client.session.call_tool(
    "calculate_mol_complexity",
    arguments={"smiles_list": smiles_list}
)
complexity_metrics = client.parse_result(result)['metrics']

## Merge all descriptors by SMILES
complete_profiles = merge_lists_by_smiles(
    basic_metrics,
    hydrophobicity_metrics,
    hbond_metrics,
    structure_metrics,
    topology_metrics,
    chemistry_metrics,
    charge_metrics,
    complexity_metrics
)

## Display results
for profile in complete_profiles:
    print(f"\nSMILES: {profile['smiles']}")
    print(f"Molecular Formula: {profile['molecular_formula']}")
    print(f"Molecular Weight: {profile['molecular_weight']:.2f}")
    print(f"LogP: {profile['logp']:.2f}")
    print(f"QED Score: {profile['qed']:.4f}")
    print(f"H-Bond Donors: {profile['num_h_donors']}")
    print(f"H-Bond Acceptors: {profile['num_h_acceptors']}")
    print(f"TPSA: {profile['tpsa']:.2f}")
    print(f"Lipinski Violations: {profile['lipinski_rule_of_5_violations']}")

await client.disconnect()
```

### Descriptor Categories

#### 1. Basic Properties
- `molecular_formula`: Molecular formula
- `molecular_weight`: Molecular weight (Da)
- `num_heavy_atoms`: Count of non-hydrogen atoms
- `num_atoms`, `num_bonds`: Total atom and bond counts
- `formal_charge`: Overall formal charge

#### 2. Hydrophobicity
- `logp`: Partition coefficient (lipophilicity)
- `molar_refractivity`: Molar refractivity
- `fraction_csp3`: Fraction of sp3 carbons (saturation)

#### 3. Hydrogen Bonding
- `num_h_donors`: H-bond donor count
- `num_h_acceptors`: H-bond acceptor count
- `tpsa`: Topological polar surface area (Ų)

#### 4. Structural Complexity
- `num_rings`, `num_aromatic_rings`: Ring counts
- `num_rotatable_bonds`: Flexible bonds
- `num_heteroatoms`: Non-C/H atoms

#### 5. Topological Descriptors
- `chi0v`-`chi4v`: Chi connectivity indices
- `kappa1`-`kappa3`: Kappa shape indices
- `hall_kier_alpha`: Hall-Kier alpha value

#### 6. Drug Chemistry
- `qed`: Quantitative Estimate of Drug-likeness (0-1)
- `lipinski_rule_of_5_violations`: Lipinski violations (0-4)

#### 7. Charge Properties
- `min/max/avg_gasteiger_charge`: Gasteiger partial charges
- `gasteiger_charge_range`: Charge distribution range

#### 8. Complexity Metrics
- `molecular_complexity`: Bertz complexity index
- `aromatic_proportion`: Fraction of aromatic atoms
- `asphericity`: 3D shape asphericity

### Input/Output

**Input:**
- `smiles_list`: List of SMILES strings

**Output:**
- List of dictionaries, each containing 50+ molecular descriptors for one molecule

### Applications

- **QSAR Modeling**: Use descriptors as features for predictive models
- **Drug Discovery**: Screen compounds by drug-likeness and physicochemical properties
- **Chemical Space Analysis**: Visualize and cluster molecules by properties
- **Lead Optimization**: Track property changes during optimization
- **Virtual Screening**: Filter libraries by desired property ranges

### Property Filters for Drug-likeness

Typical ranges for oral drug candidates:
- Molecular Weight: 150-500 Da
- LogP: 0-5
- H-Bond Donors: ≤ 5
- H-Bond Acceptors: ≤ 10
- TPSA: 20-140 Ų
- Rotatable Bonds: ≤ 10
- QED Score: > 0.5
