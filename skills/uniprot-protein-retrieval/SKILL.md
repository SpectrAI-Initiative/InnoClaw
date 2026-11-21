---
name: uniprot-protein-retrieval
description: Retrieve protein sequences and functional information from UniProt database by protein name, enabling protein analysis and bioinformatics workflows.
license: MIT license
metadata:
    skill-author: PJLab
---

# UniProt Protein Sequence Retrieval

## Usage

### 1. MCP Server Definition

Use the standard MCP client pattern for Origene-UniProt server.

### 2. Protein Sequence Retrieval Workflow

This workflow retrieves protein sequences and associated information from the UniProt database using protein names or identifiers.

**Workflow Steps:**

1. **Query by Protein Name** - Search UniProt using common protein names
2. **Retrieve Sequence Data** - Get amino acid sequence and metadata

**Implementation:**

```python
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession
import json
from contextlib import AsyncExitStack

class OrigeneClient:
    def __init__(self, server_url: str):
        self.server_url = server_url
        self.session = None

    async def connect(self):
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
            print("✓ Connected to Origene-UniProt")
            return True
        except Exception as e:
            print(f"✗ Connection failed: {e}")
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
            return {"error": f"Parse error: {e}", "raw": str(result)}

## Initialize client
client = OrigeneClient("https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt")
if not await client.connect():
    print("Connection failed")
    return

## Step 1: Retrieve protein sequence by name
protein_name = "insulin"  # Can be common name, gene symbol, or UniProt ID

result = await client.session.call_tool(
    "get_protein_sequence_by_name",
    arguments={
        "protein_name": protein_name
    }
)

result_data = client.parse_result(result)

## Display results
print(f"\nProtein: {protein_name}")
print("=" * 80)

if "sequence" in result_data:
    sequence = result_data["sequence"]
    print(f"Amino Acid Sequence ({len(sequence)} residues):")
    print(sequence)

    # Format sequence in blocks of 60
    print("\nFormatted Sequence:")
    for i in range(0, len(sequence), 60):
        position = i + 1
        block = sequence[i:i+60]
        print(f"{position:6d} {block}")

if "uniprot_id" in result_data:
    print(f"\nUniProt ID: {result_data['uniprot_id']}")

if "protein_names" in result_data:
    print(f"Protein Names: {result_data['protein_names']}")

if "organism" in result_data:
    print(f"Organism: {result_data['organism']}")

if "function" in result_data:
    print(f"Function: {result_data['function'][:200]}...")

await client.disconnect()
```

### Extended Example: Multiple Protein Retrieval

```python
## Retrieve multiple proteins
protein_list = ["p53", "BRCA1", "insulin", "hemoglobin"]

sequences = {}
for protein in protein_list:
    result = await client.session.call_tool(
        "get_protein_sequence_by_name",
        arguments={"protein_name": protein}
    )
    data = client.parse_result(result)

    if "sequence" in data:
        sequences[protein] = {
            "sequence": data["sequence"],
            "length": len(data["sequence"]),
            "uniprot_id": data.get("uniprot_id", "N/A")
        }

## Display summary
print("\nProtein Sequence Summary:")
print(f"{'Protein':<15} {'UniProt ID':<12} {'Length':<10}")
print("-" * 40)
for name, info in sequences.items():
    print(f"{name:<15} {info['uniprot_id']:<12} {info['length']:<10}")
```

### Tool Description

**Origene-UniProt Server:**

- `get_protein_sequence_by_name`: Retrieve protein sequence from UniProt database
  - Args:
    - `protein_name` (str): Protein common name, gene symbol, or UniProt ID
  - Returns:
    - `sequence` (str): Amino acid sequence (one-letter code)
    - `uniprot_id` (str): UniProt accession number
    - `protein_names` (str): Official and alternative protein names
    - `organism` (str): Source organism
    - `function` (str): Protein function description
    - `length` (int): Sequence length in residues
    - `mass` (float): Molecular mass (Da)

### Input/Output

**Input:**
- `protein_name`: Protein identifier (flexible format)
  - Examples: "insulin", "P53", "BRCA1", "P01308"
  - Supports: common names, gene symbols, UniProt IDs

**Output:**
- Protein sequence and comprehensive metadata
- Ready for downstream analysis (alignment, structure prediction, etc.)

### Supported Query Types

1. **Common Names**: "insulin", "hemoglobin", "actin"
2. **Gene Symbols**: "TP53", "BRCA1", "EGFR"
3. **UniProt IDs**: "P01308", "P04637"
4. **Protein Families**: "kinase", "protease" (returns multiple entries)

### Applications

**Use retrieved sequences for:**

- Protein alignment and homology analysis
- Structure prediction (AlphaFold, ESM Fold)
- Primer design for cloning
- Antibody epitope mapping
- Conservation analysis
- Mutation impact assessment
- Phylogenetic studies

### Integration with Other Workflows

**Combine with:**

1. **Protein BLAST** → Find homologs
2. **InterProScan** → Identify domains
3. **AlphaFold** → Predict 3D structure
4. **STRING** → Find protein interactions
5. **OpenTargets** → Link to diseases

### Example: Complete Protein Analysis Pipeline

```python
## 1. Retrieve sequence
result = await uniprot_client.session.call_tool(
    "get_protein_sequence_by_name",
    arguments={"protein_name": "BRCA1"}
)
sequence = uniprot_client.parse_result(result)["sequence"]

## 2. Find similar proteins (BLAST)
result = await biotools_client.session.call_tool(
    "blast_search",
    arguments={
        "sequence": sequence,
        "evalue": 1e-10,
        "max_hits": 20
    }
)
homologs = biotools_client.parse_result(result)

## 3. Identify domains (InterProScan)
result = await biotools_client.session.call_tool(
    "interproscan_analyze",
    arguments={
        "sequence": sequence,
        "databases": ["Pfam", "SMART"]
    }
)
domains = biotools_client.parse_result(result)

## 4. Get disease associations (OpenTargets)
result = await opentargets_client.session.call_tool(
    "get_target_associated_diseases",
    arguments={"gene_symbol": "BRCA1"}
)
diseases = opentargets_client.parse_result(result)

print(f"Complete analysis for BRCA1:")
print(f"- Sequence length: {len(sequence)} amino acids")
print(f"- Homologs found: {len(homologs)}")
print(f"- Functional domains: {len(domains)}")
print(f"- Associated diseases: {len(diseases)}")
```

### Error Handling

**Common issues:**

- **Protein not found**: Check spelling, try alternative names or UniProt ID
- **Multiple matches**: Use more specific identifier (UniProt ID preferred)
- **No sequence available**: Some entries may lack sequence data
- **Network timeout**: Retry with exponential backoff

### Data Quality Notes

- UniProt is manually curated (Swiss-Prot) and computationally annotated (TrEMBL)
- Sequence quality: Swiss-Prot entries are highly reliable
- Updates: UniProt is updated regularly; sequences may change
- Isoforms: Multiple isoforms may exist; canonical sequence is returned by default
