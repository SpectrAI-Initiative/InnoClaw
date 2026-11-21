---
name: interproscan-domain-analysis
description: Analyze protein sequences using InterProScan to identify functional domains, protein families, and Gene Ontology (GO) annotations.
license: MIT license
metadata:
    skill-author: PJLab
---

# InterProScan Protein Domain Analysis

## Usage

### 1. MCP Server Definition

Use the same `BioInfoToolsClient` class as defined in the protein-blast-search skill.

### 2. InterProScan Domain Analysis Workflow

This workflow analyzes protein sequences using InterProScan to identify functional domains, protein families, binding sites, and associated Gene Ontology annotations.

**Workflow Steps:**

1. **Validate Sequence** - Check protein sequence format and length
2. **Run InterProScan** - Identify domains using multiple signature databases
3. **Extract Annotations** - Parse domain locations, families, and GO terms

**Implementation:**

```python
from datetime import timedelta

## Initialize client
client = BioInfoToolsClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/17/BioInfo-Tools",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

## Input: Protein sequence to analyze
protein_sequence = """
MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH
"""

## Step 1 & 2: Run InterProScan analysis
result = await client.session.call_tool(
    "interproscan_analyze",
    arguments={
        "sequence": protein_sequence.strip(),
        "sequence_id": "HBB_HUMAN",        # Optional identifier
        "databases": ["Pfam"],              # Signature databases to use
        "goterms": True                     # Include GO term annotations
    },
    read_timeout_seconds=timedelta(seconds=900)  # Allow up to 15 minutes
)

## Step 3: Parse and display results
result_data = client.parse_result(result)

if result_data.get("success"):
    results = result_data.get("results", {})
    domains = results.get("domains", [])
    go_terms = results.get("go_terms", [])

    print(f"✅ InterProScan analysis completed successfully")
    print(f"Execution time: {result_data.get('time_seconds', '?')} seconds")
    print(f"Domains found: {len(domains)}")
    print(f"GO annotations: {len(go_terms)}\n")

    # Display domain information
    if domains:
        print("=== Functional Domains ===\n")
        for i, domain in enumerate(domains, 1):
            print(f"{i}. {domain.get('name', 'N/A')}")
            print(f"   Accession: {domain.get('accession', 'N/A')}")
            print(f"   Database: {domain.get('database', 'N/A')}")
            if domain.get('description'):
                print(f"   Description: {domain.get('description')}")

            # Display domain locations
            locations = domain.get('locations', [])
            if locations:
                print(f"   Locations:")
                for loc in locations:
                    print(f"     - Position {loc.get('start')}-{loc.get('end')} aa")
                    if loc.get('score'):
                        print(f"       Score: {loc.get('score')}")
            print()

    # Display GO annotations
    if go_terms:
        print("=== Gene Ontology Annotations ===\n")

        # Group by category
        by_category = {}
        for go in go_terms:
            category = go.get('category', 'UNKNOWN')
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(go)

        for category, terms in by_category.items():
            print(f"{category}:")
            for go in terms:
                print(f"  - {go.get('id', 'N/A')}: {go.get('name', 'N/A')}")
            print()
else:
    print(f"❌ InterProScan analysis failed: {result_data.get('error', 'Unknown error')}")

await client.disconnect()
```

### Tool Descriptions

**BioInfo-Tools Server:**
- `interproscan_analyze`: Analyze protein sequence using InterProScan
  - Args:
    - `sequence` (str): Protein sequence in amino acid single-letter code
    - `sequence_id` (str, optional): Identifier for the query sequence
    - `databases` (list, optional): Signature databases to query (default: ["Pfam"])
    - `goterms` (bool, optional): Include GO term annotations (default: True)
  - Returns:
    - `success` (bool): Whether analysis completed successfully
    - `results` (dict): Analysis results containing domains and GO terms
    - `time_seconds` (float): Execution time

### Input/Output

**Input:**
- `sequence`: Protein sequence (amino acid single-letter code)
- `sequence_id`: Optional identifier for the query
- `databases`: List of signature databases (e.g., ["Pfam", "SMART", "PRINTS"])
- `goterms`: Whether to include Gene Ontology annotations

**Output:**
- `domains`: List of identified protein domains, each containing:
  - `name`: Domain or family name
  - `accession`: Database accession number
  - `database`: Source database (e.g., "PFAM", "SMART")
  - `description`: Functional description
  - `locations`: List of domain positions in the sequence
    - `start`: Start position (amino acid number)
    - `end`: End position (amino acid number)
    - `score`: Match score (if available)
- `go_terms`: List of GO annotations, each containing:
  - `id`: GO identifier (e.g., "GO:0020037")
  - `name`: GO term name
  - `category`: GO category (MOLECULAR_FUNCTION, BIOLOGICAL_PROCESS, or CELLULAR_COMPONENT)

### Available Signature Databases

InterProScan integrates multiple signature databases:
- **Pfam**: Protein families based on HMMs
- **SMART**: Simple Modular Architecture Research Tool
- **PRINTS**: Protein fingerprints
- **ProSite**: Protein domains, families, and functional sites
- **SUPERFAMILY**: Structural and functional annotation
- And more...

Default: `["Pfam"]` for fastest results

### Performance Notes

- **Typical execution time**:
  - Short sequences (~150 aa): 30-60 seconds
  - Medium sequences (~400 aa): 2-4 minutes
  - Long sequences (~800+ aa): 5-15 minutes
- **Timeout recommendation**: Set to at least 900 seconds (15 minutes)
- **Multiple databases**: Using more databases increases execution time but provides comprehensive annotation

### Use Cases

- Identify functional domains in novel protein sequences
- Predict protein function from domain composition
- Locate active sites and binding regions
- Annotate protein families and superfamilies
- Obtain GO term annotations for functional analysis
- Compare domain architecture across homologous proteins

### GO Term Categories

- **MOLECULAR_FUNCTION**: Molecular-level activities (e.g., "heme binding", "catalytic activity")
- **BIOLOGICAL_PROCESS**: Biological pathways and processes (e.g., "oxygen transport", "signal transduction")
- **CELLULAR_COMPONENT**: Cellular locations (e.g., "cytoplasm", "membrane")
