---
name: signal_processing
description: "Signal Processing Analysis - Analyze signals: duty cycle, frequency range, electron wavelength, and measurement error analysis. Use this skill for signal processing tasks involving calculate duty cycle calculate frequency range electron wavelength calculate absolute error. Combines 4 tools from 3 SCP server(s)."
---

# Signal Processing Analysis

**Discipline**: Signal Processing | **Tools Used**: 4 | **Servers**: 3

## Description

Analyze signals: duty cycle, frequency range, electron wavelength, and measurement error analysis.

## Tools Used

- **`calculate_duty_cycle`** from `server-21` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/21/Electrical_Engineering_and_Circuit_Calculations`
- **`calculate_frequency_range`** from `server-23` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics`
- **`electron_wavelength`** from `server-23` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics`
- **`calculate_absolute_error`** from `server-26` (streamable-http) - `https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis`

## Workflow

1. Calculate duty cycle
2. Calculate frequency range
3. Compute electron wavelength
4. Analyze measurement error

## Test Case

### Input
```json
{
    "pulse_width": 0.005,
    "period": 0.02
}
```

### Expected Steps
1. Calculate duty cycle
2. Calculate frequency range
3. Compute electron wavelength
4. Analyze measurement error

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
    "server-21": "https://scp.intern-ai.org.cn/api/v1/mcp/21/Electrical_Engineering_and_Circuit_Calculations",
    "server-23": "https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics",
    "server-26": "https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis"
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
        sessions["server-21"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/21/Electrical_Engineering_and_Circuit_Calculations", stack)
        sessions["server-23"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/23/Optics_and_Electromagnetics", stack)
        sessions["server-26"] = await connect("https://scp.intern-ai.org.cn/api/v1/mcp/26/Data_processing_and_statistical_analysis", stack)

        # Execute workflow steps
        # Step 1: Calculate duty cycle
        result_1 = await sessions["server-21"].call_tool("calculate_duty_cycle", arguments={})
        data_1 = parse(result_1)
        print(f"Step 1 result: {json.dumps(data_1, indent=2, ensure_ascii=False)[:500]}")

        # Step 2: Calculate frequency range
        result_2 = await sessions["server-23"].call_tool("calculate_frequency_range", arguments={})
        data_2 = parse(result_2)
        print(f"Step 2 result: {json.dumps(data_2, indent=2, ensure_ascii=False)[:500]}")

        # Step 3: Compute electron wavelength
        result_3 = await sessions["server-23"].call_tool("electron_wavelength", arguments={})
        data_3 = parse(result_3)
        print(f"Step 3 result: {json.dumps(data_3, indent=2, ensure_ascii=False)[:500]}")

        # Step 4: Analyze measurement error
        result_4 = await sessions["server-26"].call_tool("calculate_absolute_error", arguments={})
        data_4 = parse(result_4)
        print(f"Step 4 result: {json.dumps(data_4, indent=2, ensure_ascii=False)[:500]}")

        # Cleanup
        print("Workflow complete!")

if __name__ == "__main__":
    asyncio.run(main())
```
