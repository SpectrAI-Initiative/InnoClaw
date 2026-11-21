---
name: dna-rna-sequence-analysis
description: Analyze DNA and RNA sequences including molecular weight calculation, reverse complement generation, and oligonucleotide properties.
license: MIT license
metadata:
    skill-author: PJLab
---

# DNA/RNA Sequence Analysis

## Usage

### 1. MCP Server Definition

Use the same `BiologyToolsClient` class as defined in the protein-properties-calculation skill.

### 2. DNA/RNA Sequence Analysis Workflow

This workflow analyzes DNA and RNA sequences, calculating molecular weight, GC content, melting temperature, and generating reverse complements.

**Workflow Steps:**

1. **Calculate DNA Molecular Weight** - Compute molecular weight for DNA sequences
2. **Calculate Oligonucleotide Properties** - Compute GC content, Tm, extinction coefficient for RNA
3. **Generate Reverse Complement** - Create reverse complement sequence

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

print("=== DNA/RNA Sequence Analysis ===\n")

## Step 1: Calculate DNA molecular weight
print("Step 1: DNA Molecular Weight")
dna_sequence = "ATGATGTAACGTAGCTAG"
sequence_para = f"seq1:{dna_sequence}.strand=single,topology=linear"

result = await client.client.call_tool(
    "DNAMolecularWeightCalculator",
    arguments={"sequence_para": sequence_para}
)
result_data = client.parse_result(result)
print(f"DNA Sequence: {dna_sequence}")
print(f"Result:\n{result_data}\n")

## Step 2: Calculate oligonucleotide (RNA) properties
print("Step 2: Oligonucleotide (RNA) Properties")
rna_sequence = "AUGAUGUAACGUAGCUAG"

result = await client.client.call_tool(
    "CalculatorOligonucleotide",
    arguments={"sq": rna_sequence}
)
result_data = client.parse_result(result)
print(f"RNA Sequence: {rna_sequence}")
print(f"Result:\n{result_data}\n")

## Step 3: Generate reverse complement
print("Step 3: Reverse Complement")
test_sequence = "ATCGATCG"

result = await client.client.call_tool(
    "GetReverseComplement",
    arguments={"sequence": test_sequence}
)
result_data = client.parse_result(result)
print(f"Original Sequence: {test_sequence}")
print(f"Reverse Complement:\n{result_data}\n")

## Step 4: Calculate annealing temperature for primers
print("Step 4: PCR Primer Annealing Temperature")
primer_sequence = "GCTAGCTAGCTA"

result = await client.client.call_tool(
    "ComputeAnnealingTemperature",
    arguments={"sequence": primer_sequence}
)
result_data = client.parse_result(result)
print(f"Primer Sequence: {primer_sequence}")
print(f"Result:\n{result_data}\n")

await client.disconnect()
```

### Tool Descriptions

**SciToolAgent-Bio Server:**
- `DNAMolecularWeightCalculator`: Calculate DNA molecular weight
  - Args: `sequence_para` (str) - Formatted sequence with parameters
  - Format: `"seqName:SEQUENCE.strand=single/double,topology=linear/circular"`
  - Returns: Molecular weight in Daltons

- `CalculatorOligonucleotide`: Calculate oligonucleotide (RNA) properties
  - Args: `sq` (str) - RNA sequence
  - Returns: GC content (%), Tm (°C), molecular weight, extinction coefficient

- `GetReverseComplement`: Generate reverse complement sequence
  - Args: `sequence` (str) - DNA sequence
  - Returns: Reverse complement sequence

- `ComputeAnnealingTemperature`: Calculate primer annealing temperature
  - Args: `sequence` (str) - Primer sequence
  - Returns: Annealing temperature for PCR

### Input/Output

**Input:**
- DNA sequences: Use A, T, G, C nucleotides
- RNA sequences: Use A, U, G, C nucleotides
- Sequence parameters for DNA: strand type (single/double) and topology (linear/circular)

**Output:**
- **DNA Molecular Weight**: Mass in Daltons for DNA sequences
- **GC Content**: Percentage of G and C nucleotides
- **Tm (Melting Temperature)**: Temperature at which 50% of DNA is denatured
- **Extinction Coefficient**: For nucleic acid quantification (M⁻¹cm⁻¹)
- **Reverse Complement**: Complementary antiparallel sequence

### Use Cases

- Design PCR primers with appropriate annealing temperatures
- Calculate oligonucleotide concentrations spectrophotometrically
- Generate reverse complement for sequencing analysis
- Analyze GC content for primer design
- Plan molecular cloning experiments
- Estimate DNA/RNA molecular weights
- Design and analyze synthetic oligonucleotides

### Sequence Format for DNA Molecular Weight

Format: `"seqName:SEQUENCE.strand=X,topology=Y"`

Parameters:
- `seqName`: Identifier for the sequence
- `SEQUENCE`: DNA nucleotide sequence (A, T, G, C)
- `strand`: Either "single" or "double"
- `topology`: Either "linear" or "circular"

Example: `"plasmid1:ATGCATGC.strand=double,topology=circular"`

### GC Content and Tm

- **High GC content (>60%)**: Higher melting temperature, more stable
- **Low GC content (<40%)**: Lower melting temperature, less stable
- **Tm**: Used to determine PCR annealing temperature (typically Tm - 5°C)

### Additional DNA/RNA Tools Available

- `ORFFind`: Find open reading frames
- `TranslateDNAtoAminoAcidSequence`: Translate DNA to protein
- `RepeatDNASequenceSearch`: Find repetitive sequences
- `CpGIslandPrediction`: Predict CpG islands
- `PCRPrimerProperties`: Analyze primer properties
- `RandomDNAGeneration`: Generate random DNA sequences
- `CircularDNAAlignment`: Align circular DNA sequences
