---
name: protein-blast-search
description: Search for similar protein sequences in UniProt Swiss-Prot database using BLAST to identify homologous proteins and functional relationships.
license: MIT license
metadata:
    skill-author: PJLab
---

# Protein BLAST Sequence Similarity Search

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class BioInfoToolsClient:
    """BioInfo-Tools MCP Client"""

    def __init__(self, server_url: str, api_key: str):
        self.server_url = server_url
        self.api_key = api_key
        self.session = None

    async def connect(self):
        """Establish connection and initialize session"""
        print(f"server url: {self.server_url}")
        try:
            self.transport = streamablehttp_client(
                url=self.server_url,
                headers={"SCP-HUB-API-KEY": self.api_key}
            )
            self._stack = AsyncExitStack()
            await self._stack.__aenter__()
            self.read, self.write, self.get_session_id = await self._stack.enter_async_context(self.transport)

            self.session_ctx = ClientSession(self.read, self.write)
            self.session = await self._stack.enter_async_context(self.session_ctx)

            await self.session.initialize()
            session_id = self.get_session_id()

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
                    return json.loads(content.text)
            return str(result)
        except Exception as e:
            return {"error": f"parse error: {e}", "raw": str(result)}
```

### 2. Protein BLAST Search Workflow

This workflow searches for similar protein sequences in the UniProt Swiss-Prot database using BLAST, identifying homologous proteins and their functional relationships.

**Workflow Steps:**

1. **Validate Input** - Ensure protein sequence is in valid amino acid format
2. **Execute BLAST Search** - Query UniProt Swiss-Prot database for similar sequences
3. **Parse Results** - Extract matching proteins with identity, E-value, and organism information

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

## Input: Protein sequence to search
protein_sequence = """
MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH
"""

## Step 1 & 2: Execute BLAST search against UniProt Swiss-Prot
result = await client.session.call_tool(
    "blast_search",
    arguments={
        "sequence": protein_sequence.strip(),
        "sequence_id": "HBB_HUMAN",  # Optional identifier
        "evalue": 0.01,              # E-value threshold (default: 0.01)
        "max_hits": 50               # Maximum number of hits to return
    },
    read_timeout_seconds=timedelta(seconds=300)  # Allow up to 5 minutes
)

## Step 3: Parse and display results
result_data = client.parse_result(result)

if result_data.get("success"):
    print(f"✅ BLAST search completed successfully")
    print(f"Execution time: {result_data.get('time_seconds', '?')} seconds")
    print(f"Total hits found: {result_data.get('total_hits', 0)}\n")

    hits = result_data.get("hits", [])

    # Display top matches
    for i, hit in enumerate(hits[:10], 1):
        print(f"{i}. {hit['uniprot_id']} - {hit.get('organism', 'N/A')}")
        print(f"   Description: {hit['description']}")
        print(f"   Identity: {hit['identity_percent']:.1f}%")
        print(f"   E-value: {hit['evalue']:.2e}")
        print(f"   Alignment length: {hit['alignment_length']} aa\n")
else:
    print(f"❌ BLAST search failed: {result_data.get('error', 'Unknown error')}")

await client.disconnect()
```

### Tool Descriptions

**BioInfo-Tools Server:**
- `blast_search`: Search for similar protein sequences in UniProt Swiss-Prot database
  - Args:
    - `sequence` (str): Protein sequence in amino acid single-letter code
    - `sequence_id` (str, optional): Identifier for the query sequence
    - `evalue` (float, optional): E-value threshold (default: 0.01)
    - `max_hits` (int, optional): Maximum number of hits to return (default: 50)
  - Returns:
    - `success` (bool): Whether search completed successfully
    - `total_hits` (int): Number of matching sequences found
    - `hits` (list): List of matching proteins with details
    - `time_seconds` (float): Execution time

### Input/Output

**Input:**
- `sequence`: Protein sequence (amino acid single-letter code)
- `sequence_id`: Optional identifier for the query
- `evalue`: E-value threshold (lower = more stringent, default: 0.01)
- `max_hits`: Maximum number of results to return (default: 50)

**Output:**
- List of similar proteins, each containing:
  - `uniprot_id`: UniProt accession number
  - `description`: Protein description and name
  - `organism`: Species/organism name
  - `identity_percent`: Sequence identity percentage (0-100)
  - `evalue`: E-value (statistical significance, lower is better)
  - `alignment_length`: Length of sequence alignment
  - `query_coverage`: Percentage of query sequence covered

### E-value Interpretation

- **E-value < 1e-10**: Highly significant match, very likely homologous
- **E-value < 1e-5**: Significant match, likely homologous
- **E-value < 0.01**: Potentially homologous (default threshold)
- **E-value > 0.01**: May be spurious matches

### Use Cases

- Identify protein function by homology
- Find evolutionarily related proteins
- Discover orthologs and paralogs across species
- Annotate unknown protein sequences
- Study protein evolution and phylogeny

### Performance Notes

- **Typical execution time**: 10-90 seconds depending on sequence length and max_hits
- **Shorter sequences** (<50 aa): May return more non-specific matches
- **Longer sequences** (>500 aa): May take longer but provide more specific matches
- **Timeout recommendation**: Set to at least 300 seconds (5 minutes) for reliability
