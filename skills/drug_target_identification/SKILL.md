---
name: drug_target_identification
description: "Drug Target Identification Pipeline - Identify drug targets for a disease by querying OpenTargets for associated targets, then retrieve detailed target info from ChEMBL and protein data from UniProt. Use this skill for drug discovery tasks involving get associated targets by disease efoId get target by name get general info by protein or gene name. Combines 3 tools from 3 SCP server(s)."
---

# Drug Target Identification Pipeline

**Discipline**: Drug Discovery | **Tools Used**: 3 | **Servers**: 3

## Description

Identify drug targets for a disease by querying OpenTargets for associated targets, then retrieve detailed target info from ChEMBL and protein data from UniProt.

## Tools Used

- **`get_associated_targets_by_disease_efoId`** from `opentargets-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets`
- **`get_target_by_name`** from `chembl-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL`
- **`get_general_info_by_protein_or_gene_name`** from `uniprot-server` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt`

## Workflow

1. Query OpenTargets for lung cancer targets
2. Get EGFR target details from ChEMBL
3. Get EGFR protein info from UniProt

## Test Case

### Input
```json
{
    "disease_efo_id": "EFO_0000311",
    "disease_name": "lung cancer"
}
```

### Expected Steps
1. Query OpenTargets for lung cancer targets
2. Get EGFR target details from ChEMBL
3. Get EGFR protein info from UniProt

## Usage Example

> **Note:** Replace `sk-b04409a1-b32b-4511-9aeb-22980abdc05c` with your own SCP Hub API Key. You can obtain one from the [SCP Platform](https://scphub.intern-ai.org.cn).

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from mcp.client.sse import sse_client

SERVERS = {
    "opentargets-server": "https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets",
    "chembl-server": "https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL",
    "uniprot-server": "https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt"
}

async def connect(url, stack):
    transport = streamablehttp_client(url=url, headers={"SCP-HUB-API-KEY": "sk-b04409a1-b32b-4511-9aeb-22980abdc05c"})
    read, write, _ = await stack.enter_async_context(transport)
    ctx = ClientSession(read, write)
    session = await stack.enter_async_context(ctx)
    await session.initialize()
    return session

def parse(result):
    try:
        if hasattr(result, 'content') and result.content:
            c = result.content[0]
            if hasattr(c, 'text'):
                try: return json.loads(c.text)
                except: return c.text
        return str(result)
    except: return str(result)

async def main():
    async with AsyncExitStack() as stack:
        # Connect to required servers
        sessions = {}
        sessions["opentargets-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/15/Origene-OpenTargets", stack)
        sessions["chembl-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/4/Origene-ChEMBL", stack)
        sessions["uniprot-server"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/10/Origene-UniProt", stack)

        # Execute workflow steps
        # Step 1: Query OpenTargets for lung cancer targets
        result_1 = await sessions["opentargets-server"].call_tool("get_associated_targets_by_disease_efoId", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Get EGFR target details from ChEMBL
        result_2 = await sessions["chembl-server"].call_tool("get_target_by_name", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Get EGFR protein info from UniProt
        result_3 = await sessions["uniprot-server"].call_tool("get_general_info_by_protein_or_gene_name", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
