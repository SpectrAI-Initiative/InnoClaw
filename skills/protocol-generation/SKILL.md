---
name: protocol-generation-from-description
description: Generate detailed laboratory protocols from natural language descriptions using AI, producing step-by-step experimental procedures ready for lab execution.
license: MIT license
metadata:
    skill-author: PJLab
---

# Laboratory Protocol Generation Workflow

## Usage

### 1. MCP Server Definition

Use the same `DrugSDAClient` class pattern with Thoth-Plan server.

### 2. Protocol Generation from User Description

This workflow generates detailed laboratory protocols from natural language descriptions, useful for experimental planning and automation.

**Workflow Steps:**

1. **Input User Description** - Provide natural language description of desired protocol
2. **Generate Detailed Protocol** - AI generates step-by-step experimental procedure
3. **Optional: Convert to Executable Format** - Transform protocol to machine-readable JSON for automation

**Implementation:**

```python
client = DrugSDAClient("https://scp.intern-ai.org.cn/api/v1/mcp/19/Thoth-Plan")
if not await client.connect():
    print("connection failed")
    return

## Step 1: Provide protocol description
user_prompt = """
I need a PCR protocol for amplifying a 500bp DNA fragment.
Use a standard Taq polymerase with the following conditions:
- Annealing temperature: 55°C
- Extension time: 30 seconds
- 30 cycles total
Include primer concentrations and buffer composition.
"""

## Step 2: Generate detailed protocol
result = await client.session.call_tool(
    "protocol_generation",
    arguments={
        "user_prompt": user_prompt
    }
)

protocol_text = client.parse_result(result)["protocol"]

print("Generated Protocol:")
print("=" * 80)
print(protocol_text)
print("=" * 80)

## Step 3 (Optional): Convert to executable JSON for lab automation
result = await client.session.call_tool(
    "generate_executable_json",
    arguments={
        "protocol": protocol_text
    }
)

executable_json = client.parse_result(result)["executable_json"]
print("\nExecutable JSON for lab automation:")
print(executable_json)

## Step 4 (Optional): Execute protocol via lab automation system
result = await client.session.call_tool(
    "execute_json",
    arguments={
        "executable_json": executable_json
    }
)

execution_info = client.parse_result(result)
print("\nExecution Info:")
print(execution_info)

await client.disconnect()
```

### Tool Descriptions

**Thoth-Plan Server:**

- `protocol_generation`: Generate detailed laboratory protocol from description
  - Args: `user_prompt` (str) - Natural language description of desired protocol
  - Returns: `protocol` (str) - Detailed step-by-step protocol text

- `generate_executable_json`: Convert protocol text to machine-readable format
  - Args: `protocol` (str) - Protocol text
  - Returns: `executable_json` (str) - JSON format for Opentrons/lab automation

- `execute_json`: Execute protocol via connected lab automation systems
  - Args: `executable_json` (str) - Executable protocol JSON
  - Returns: Execution status and log

### Input/Output

**Input:**
- `user_prompt`: Natural language description of desired experimental protocol
  - Can include: reagents, conditions, equipment, expected outcomes
  - Can reference standard protocols or specific parameters

**Output:**
- `protocol`: Detailed step-by-step protocol including:
  - Materials and reagents list
  - Equipment requirements
  - Detailed procedure steps
  - Safety considerations
  - Expected results
  - Troubleshooting tips

### Example Protocol Types

The system can generate protocols for various laboratory procedures:

- **Molecular Biology**: PCR, cloning, gel electrophoresis, DNA extraction, transformation
- **Protein Science**: Protein purification, Western blot, ELISA, protein crystallization
- **Cell Culture**: Cell passage, transfection, differentiation, cryopreservation
- **Biochemistry**: Enzyme assays, metabolite extraction, chromatography
- **Analytical**: Spectroscopy, mass spectrometry sample prep, HPLC

### Protocol Quality Guidelines

Generated protocols include:
- ✓ Precise volumes and concentrations
- ✓ Specific temperatures and times
- ✓ Safety warnings where applicable
- ✓ Quality control checkpoints
- ✓ Troubleshooting guidance

### Integration with Lab Automation

The generated protocols can be converted to executable JSON format compatible with:
- Opentrons liquid handling robots
- Hamilton automated workstations
- Custom lab automation systems
- Electronic lab notebooks (ELNs)

### Best Practices

**For optimal protocol generation:**

1. **Be Specific**: Include target specifications (e.g., "500bp fragment", "55°C annealing")
2. **Mention Equipment**: Specify if using particular instruments or kits
3. **State Goals**: Describe the experimental objective
4. **Include Constraints**: Note any limitations (time, budget, available reagents)
5. **Reference Standards**: Mention if following particular methods or publications

**Example Good Prompts:**

```
"Generate a Western blot protocol for detecting GAPDH (37 kDa) in HEK293 cell lysates using a standard semi-dry transfer system"

"I need a DNA extraction protocol from plant tissue (Arabidopsis leaves) optimized for downstream PCR. Yield target is 50 µg from 100mg tissue"

"Create a protein purification protocol for His-tagged recombinant protein from E. coli using IMAC chromatography. Starting culture volume is 500mL"
```

### Limitations

- Generated protocols should be reviewed by qualified personnel before execution
- May require adjustment based on specific lab equipment and reagents
- Safety protocols should be verified against institutional guidelines
- Novel or untested procedures may need optimization
