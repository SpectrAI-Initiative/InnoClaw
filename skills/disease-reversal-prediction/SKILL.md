---
name: disease-reversal-prediction
description: Predict a molecule's ability to reverse disease states using DLEPS (Disease-Ligand Embedding Projection Score) for drug repositioning and discovery.
license: MIT license
metadata:
    skill-author: PJLab
---

# Disease State Reversal Prediction

## Usage

###

1. MCP Server Definition

Use the same `DrugSDAClient` class as defined in the drug-screening-docking skill.

### 2. Disease State Reversal Prediction Workflow

This workflow validates SMILES strings and predicts their ability to reverse disease states, useful for drug repositioning and therapeutic discovery.

**Workflow Steps:**

1. **Validate SMILES** - Check if input SMILES strings are chemically valid
2. **Calculate DLEPS Score** - Predict disease state reversal scores for valid molecules

**Implementation:**

```python
tool_client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool")
model_client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/3/DrugSDA-Model")

if not await tool_client.connect() or not await model_client.connect():
    print("connection failed")
    return

## Input: List of candidate SMILES strings
smiles_list = [
    'Nc1nnc(S(=O)(=O)NCCc2ccc(O)cc2)s1',
    'COc1ccc2c(=O)cc(C(=O)N3CCN(c4ccc(F)cc4)CC3)oc2c1',
    'ABCCOOO'  # Invalid SMILES for demonstration
]

## Step 1: Validate SMILES strings
result = await tool_client.session.call_tool(
    "is_valid_smiles",
    arguments={"smiles_list": smiles_list}
)
result_data = tool_client.parse_result(result)
valid_smiles_list = [x['smiles'] for x in result_data['valid_res'] if x['is_valid'] is True]

print(f"Valid SMILES: {len(valid_smiles_list)}/{len(smiles_list)}")

## Step 2: Calculate DLEPS scores for disease state reversal
disease_name = "Aging"  # Can be: Aging, Alzheimer's, Parkinson's, etc.

result = await model_client.session.call_tool(
    "calculate_dleps_score",
    arguments={
        "smiles_list": valid_smiles_list,
        "disease_name": disease_name
    }
)
result_data = model_client.parse_result(result)

## Display results sorted by score
pred_scores = sorted(result_data['pred_scores'], key=lambda x: x['cs_score'], reverse=True)
for item in pred_scores:
    print(f"SMILES: {item['smiles']}")
    print(f"Disease Reversal Score: {item['cs_score']:.4f}\n")

await tool_client.disconnect()
await model_client.disconnect()
```

### Tool Descriptions

**DrugSDA-Tool Server:**
- `is_valid_smiles`: Validate SMILES strings for chemical correctness
  - Args: `smiles_list` (List[str])
  - Returns: `valid_res` with `is_valid` boolean for each SMILES

**DrugSDA-Model Server:**
- `calculate_dleps_score`: Predict disease state reversal scores
  - Args: `smiles_list` (List[str]), `disease_name` (str)
  - Returns: `pred_scores` with `cs_score` (float, 0-1) for each molecule

### Input/Output

**Input:**
- `smiles_list`: List of SMILES strings to evaluate
- `disease_name`: Target disease (e.g., "Aging", "Alzheimer's", "Parkinson's")

**Output:**
- `pred_scores`: List of dictionaries containing:
  - `smiles`: Input SMILES string
  - `cs_score`: Disease reversal score (0-1, higher is better)

### Score Interpretation

- **cs_score > 0.5**: Strong potential for disease state reversal
- **cs_score 0.2-0.5**: Moderate potential
- **cs_score < 0.2**: Low potential

Molecules with higher scores are more likely to reverse the disease-associated transcriptional signature.

### Supported Diseases

The model supports various diseases including but not limited to:
- Aging
- Alzheimer's Disease
- Parkinson's Disease
- Cardiovascular diseases
- Cancer subtypes
- Inflammatory diseases

Consult the MCP server documentation for the complete list of supported diseases.
