---
name: meta-analysis-execution
description: Perform meta-analysis on scientific studies to synthesize research findings and generate comprehensive reports with statistical summaries.
license: MIT license
metadata:
    skill-author: PJLab
---

# Meta-Analysis Execution

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class InternAgentClient:
    """InternAgent MCP Client"""

    def __init__(self, server_url: str, api_key: str):
        self.server_url = server_url
        self.api_key = api_key
        self.session = None

    async def connect(self):
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
            return True
        except Exception as e:
            print(f"✗ connect failure: {e}")
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
            return {"error": f"parse error: {e}", "raw": str(result)}
```

### 2. Meta-Analysis Workflow

Synthesize multiple studies to generate comprehensive research insights.

**Workflow Steps:**

1. **Define Research Question** - Specify meta-analysis objective
2. **Execute Analysis** - Process multiple studies systematically
3. **Generate Report** - Create summary tables or comprehensive reports

**Implementation:**

```python
## Initialize client
client = InternAgentClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/28/InternAgent",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

## Input: Meta-analysis query
prompt = "Analyze the effectiveness of mRNA vaccines against COVID-19"
report_type = "table"  # or "comprehensive"

## Execute meta-analysis
result = await client.session.call_tool(
    "MetaAnalysis",
    arguments={
        "prompt": prompt,
        "file_list": None,
        "type": report_type
    }
)

data = client.parse_result(result)

if 'final_report' in data:
    print("✅ Meta-analysis completed")
    print(f"Task ID: {data.get('task_id', 'N/A')}")
    final_report = data['final_report']
    print(f"\nReport Type: {final_report.get('type', 'N/A')}")
    print(f"\nContent:\n{final_report.get('content', 'N/A')}")
else:
    print(f"❌ Analysis failed: {data.get('error', 'Unknown error')}")

await client.disconnect()
```

### Tool Descriptions

**InternAgent Server:**
- `MetaAnalysis`: Perform meta-analysis on research studies
  - Args:
    - `prompt` (str): Research question for meta-analysis
    - `file_list` (list, optional): Additional study files
    - `type` (str): Output format ("table" or "comprehensive")
  - Returns:
    - `task_id` (str): Analysis task identifier
    - `final_report` (dict): Meta-analysis results
      - `type` (str): Report format
      - `content` (str): Analysis findings

### Input/Output

**Input:**
- `prompt`: Research question or hypothesis
- `type`: Report format (table for structured data, comprehensive for detailed analysis)
- `file_list`: Optional list of study files to include

**Output:**
- Structured report with:
  - Study summaries
  - Effect sizes and confidence intervals
  - Statistical heterogeneity metrics
  - Summary conclusions

### Use Cases

- Systematic reviews of clinical trials
- Evidence synthesis in medicine
- Research effectiveness evaluation
- Policy decision support
- Academic literature reviews

### Performance Notes

- **Execution time**: 1-5 minutes depending on number of studies
- **Output formats**: Markdown tables or comprehensive text reports
- **Data quality**: Automatically assesses study quality indicators
