---
name: comprehensive-protein-analysis
description: Comprehensive protein analysis combining InterProScan domain identification with BLAST similarity search to provide complete functional and evolutionary annotation.
license: MIT license
metadata:
    skill-author: PJLab
---

# Comprehensive Protein Analysis

## Usage

### 1. MCP Server Definition

Use the same `BioInfoToolsClient` class as defined in the protein-blast-search skill.

### 2. Comprehensive Protein Analysis Workflow

This workflow combines InterProScan domain analysis with BLAST similarity search to provide a complete functional and evolutionary annotation of a protein sequence.

**Workflow Steps:**

1. **Validate Input** - Check protein sequence format
2. **Run InterProScan** - Identify functional domains and GO terms
3. **Run BLAST Search** - Find similar sequences and homologs
4. **Integrate Results** - Combine domain and homology information for comprehensive annotation

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
MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAEDLQVGQVELGGGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCN
"""

sequence_id = "INS_HUMAN"

## Step 1, 2 & 3: Run comprehensive analysis (InterProScan + BLAST)
result = await client.session.call_tool(
    "analyze_protein",
    arguments={
        "sequence": protein_sequence.strip(),
        "sequence_id": sequence_id,
        "databases": ["Pfam"],     # InterProScan databases
        "evalue": 1e-5,             # BLAST E-value threshold (more stringent)
        "max_hits": 10              # BLAST max hits
    },
    read_timeout_seconds=timedelta(seconds=1200)  # Allow up to 20 minutes
)

## Step 4: Parse and display comprehensive results
result_data = client.parse_result(result)

print(f"{'='*80}")
print(f"Comprehensive Protein Analysis: {sequence_id}")
print(f"{'='*80}\n")

# InterProScan Results
ips_result = result_data.get("interproscan", {})
if ips_result.get("success"):
    ips_data = ips_result.get("results", {})
    domains = ips_data.get('domains', [])
    go_terms = ips_data.get('go_terms', [])

    print("=== DOMAIN ANALYSIS (InterProScan) ===")
    print(f"Execution time: {ips_result.get('time_seconds', '?')} seconds")
    print(f"Domains found: {len(domains)}")
    print(f"GO annotations: {len(go_terms)}\n")

    if domains:
        print("Functional Domains:")
        for domain in domains:
            print(f"  • {domain.get('name', 'N/A')} ({domain.get('database', 'N/A')})")
            if domain.get('description'):
                print(f"    Description: {domain.get('description')}")
            locations = domain.get('locations', [])
            if locations:
                loc = locations[0]
                print(f"    Position: {loc.get('start')}-{loc.get('end')} aa")
        print()

    if go_terms:
        print("Gene Ontology Annotations:")
        for go in go_terms[:5]:  # Show top 5
            print(f"  • {go.get('id', 'N/A')}: {go.get('name', 'N/A')}")
            print(f"    Category: {go.get('category', 'N/A')}")
        if len(go_terms) > 5:
            print(f"  ... and {len(go_terms) - 5} more")
        print()
else:
    print(f"❌ InterProScan failed: {ips_result.get('error', 'Unknown')}\n")

# BLAST Results
blast_result = result_data.get("blast", {})
if blast_result.get("success"):
    hits = blast_result.get('hits', [])

    print("=== HOMOLOGY SEARCH (BLAST) ===")
    print(f"Execution time: {blast_result.get('time_seconds', '?')} seconds")
    print(f"Similar sequences found: {blast_result.get('total_hits', 0)}")
    print(f"E-value threshold: {1e-5}\n")

    if hits:
        print("Top Homologous Proteins:")
        for i, hit in enumerate(hits[:5], 1):
            print(f"  {i}. {hit['uniprot_id']} - {hit.get('organism', 'N/A')}")
            print(f"     Description: {hit['description']}")
            print(f"     Identity: {hit['identity_percent']:.1f}%, E-value: {hit['evalue']:.2e}")
        if len(hits) > 5:
            print(f"  ... and {len(hits) - 5} more matches")
        print()
    else:
        print("No significant homologs found (E-value threshold may be too stringent)\n")
else:
    print(f"❌ BLAST failed: {blast_result.get('error', 'Unknown')}\n")

# Summary
print("=== FUNCTIONAL SUMMARY ===")
if domains:
    print(f"Protein Family: {domains[0].get('name', 'Unknown')}")
if hits:
    most_similar = hits[0]
    print(f"Most Similar Protein: {most_similar['uniprot_id']} ({most_similar['identity_percent']:.1f}% identity)")
    print(f"Organism: {most_similar.get('organism', 'Unknown')}")
print(f"{'='*80}")

await client.disconnect()
```

### Tool Descriptions

**BioInfo-Tools Server:**
- `analyze_protein`: Comprehensive protein analysis combining InterProScan and BLAST
  - Args:
    - `sequence` (str): Protein sequence in amino acid single-letter code
    - `sequence_id` (str, optional): Identifier for the query sequence
    - `databases` (list, optional): InterProScan databases (default: ["Pfam"])
    - `evalue` (float, optional): BLAST E-value threshold (default: 0.01)
    - `max_hits` (int, optional): Maximum BLAST hits (default: 10)
  - Returns:
    - `interproscan` (dict): InterProScan analysis results
      - `success` (bool): Whether InterProScan completed
      - `results` (dict): Domains and GO terms
      - `time_seconds` (float): Execution time
    - `blast` (dict): BLAST search results
      - `success` (bool): Whether BLAST completed
      - `hits` (list): Similar proteins
      - `total_hits` (int): Number of matches
      - `time_seconds` (float): Execution time

### Input/Output

**Input:**
- `sequence`: Protein sequence (amino acid single-letter code)
- `sequence_id`: Optional identifier for the query
- `databases`: List of InterProScan databases to query
- `evalue`: BLAST E-value threshold (lower = more stringent)
- `max_hits`: Maximum number of BLAST hits to return

**Output:**
- **InterProScan Results**:
  - Functional domains with positions
  - Protein family classifications
  - Gene Ontology annotations
- **BLAST Results**:
  - Homologous proteins across species
  - Sequence identity and alignment statistics
  - Evolutionary relationships

### Analysis Strategy

This comprehensive approach provides:

1. **Structural Information** (InterProScan):
   - Domain architecture and organization
   - Functional motifs and active sites
   - Protein family membership

2. **Evolutionary Context** (BLAST):
   - Homologs in other species
   - Sequence conservation patterns
   - Potential orthologs and paralogs

3. **Functional Prediction**:
   - Combining domain and homology information
   - GO term annotations for molecular function
   - Biological process involvement

### Performance Notes

- **Total execution time**: 2-20 minutes depending on sequence length
  - InterProScan: 30 seconds to 15 minutes
  - BLAST: 10-90 seconds
  - Both run sequentially in this workflow
- **Timeout recommendation**: Set to at least 1200 seconds (20 minutes)
- **E-value tuning**: Use lower E-values (e.g., 1e-10) for highly conserved proteins, higher (e.g., 0.01) for divergent families

### Use Cases

- Complete functional annotation of unknown proteins
- Validate predicted protein functions
- Study protein evolution and conservation
- Identify potential drug targets
- Annotate proteomes and genome sequences
- Compare protein function across species

### Interpretation Tips

- **High domain coverage + high homology**: Well-characterized protein with known function
- **Domains but no homologs**: Novel protein with conserved domains, function can be inferred from domains
- **Homologs but no domains**: May need more sensitive domain detection or represents a novel fold
- **Neither domains nor homologs**: Potentially novel protein, may require experimental characterization
