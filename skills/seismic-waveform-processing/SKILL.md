---
name: seismic-waveform-processing
description: Process seismic waveform data including reading MinISEED/SAC files, extracting metadata, and visualizing earthquake signals.
license: MIT license
metadata:
    skill-author: PJLab
---

# Seismic Waveform Processing

## Usage

### 1. MCP Server Definition

```python
import asyncio
import json
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

class SeismicClient:
    """SeisOBS-Tool MCP Client"""

    def __init__(self, server_url: str, api_key: str):
        self.server_url = server_url
        self.api_key = api_key
        self.session = None

    async def connect(self):
        """Establish connection and initialize session"""
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

### 2. Seismic Waveform Processing Workflow

This workflow processes seismic waveform data from MinISEED or SAC files.

**Workflow Steps:**

1. **Read Waveform Data** - Load seismic data from file
2. **Extract Metadata** - Retrieve station and instrument information
3. **Visualize Waveform** - Generate time-series plot

**Implementation:**

```python
## Initialize client
client = SeismicClient(
    "https://scp.intern-ai.org.cn/api/v1/mcp/33/SeisOBS-Tool",
    "<your-api-key>"
)

if not await client.connect():
    print("connection failed")
    exit()

## Input: Path to seismic data file (URL or local path)
data_path = "https://example.com/seismic_data.mseed"
channel_idx = 0  # Channel index to process

## Step 1: Read waveform data
result = await client.session.call_tool(
    "read_mseed_file",
    arguments={
        "data_path": data_path,
        "channel_idx": channel_idx
    }
)

waveform_data = client.parse_result(result)
print(f"Waveform data shape: {len(waveform_data['st'])} samples")

## Step 2: Extract metadata
result = await client.session.call_tool(
    "read_mseed_file_stats",
    arguments={
        "data_path": data_path,
        "channel_idx": channel_idx,
        "outfile": None
    }
)

metadata = client.parse_result(result)
print(f"Station: {metadata.get('station', 'N/A')}")
print(f"Sampling rate: {metadata.get('sampling_rate', 'N/A')} Hz")

## Step 3: Visualize waveform
result = await client.session.call_tool(
    "plot_single_waveform",
    arguments={
        "data_path": data_path,
        "channel_idx": channel_idx,
        "outfile": None,
        "starttime": None,
        "endtime": None
    }
)

plot_result = client.parse_result(result)
print(f"Waveform plot saved to: {plot_result['st']}")

await client.disconnect()
```

### Tool Descriptions

**SeisOBS-Tool Server:**
- `read_mseed_file`: Read waveform data from MinISEED file
  - Args:
    - `data_path` (str): Path or URL to MinISEED file
    - `channel_idx` (int): Channel index to read
  - Returns: Waveform time series data

- `read_mseed_file_stats`: Extract metadata from MinISEED file
  - Args:
    - `data_path` (str): Path or URL to MinISEED file
    - `channel_idx` (int): Channel index
    - `outfile` (str, optional): Output file path
  - Returns: Station metadata and instrument information

- `plot_single_waveform`: Generate waveform plot
  - Args:
    - `data_path` (str): Path or URL to MinISEED file
    - `channel_idx` (int): Channel index
    - `outfile` (str, optional): Output image path
    - `starttime` (str, optional): Plot start time
    - `endtime` (str, optional): Plot end time
  - Returns: Path to generated plot image

### Input/Output

**Input:**
- `data_path`: Path or URL to seismic data file (MinISEED or SAC format)
- `channel_idx`: Index of the channel to process (0-based)
- `starttime`/`endtime`: Optional time window for plotting

**Output:**
- Waveform data array
- Metadata including station, sampling rate, start time
- Visualization image (PNG format)

### Use Cases

- Earthquake signal analysis
- Seismic station quality control
- Waveform data preprocessing
- P-wave and S-wave identification
- Ground motion visualization

### Performance Notes

- **File formats**: MinISEED (.mseed), SAC (.sac)
- **Execution time**: <5 seconds for typical earthquake recordings
- **Data size**: Handles files up to 100 MB efficiently
