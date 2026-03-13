import { tool } from "ai";
import { z } from "zod";
import { execInWorkspace } from "@/lib/utils/shell";
import type { ToolContext } from "./types";

/**
 * Python helper script that connects to an MCP server and lists all available tools.
 * Returns JSON with tool names, descriptions, and parameter schemas.
 */
function buildListToolsPythonScript(url: string, apiKey?: string): string {
  const headersObj = apiKey
    ? `{"SCP-HUB-API-KEY": ${JSON.stringify(apiKey)}}`
    : "{}";

  return `
import json, asyncio, sys

async def main():
    try:
        from mcp.client.streamable_http import streamablehttp_client
        from mcp import ClientSession
    except ImportError:
        print(json.dumps({"error": "mcp package not installed. Run: pip install mcp"}))
        return

    url = ${JSON.stringify(url)}
    headers = ${headersObj}

    try:
        transport = streamablehttp_client(url=url, headers=headers)
        read, write, _ = await transport.__aenter__()
        ctx = ClientSession(read, write)
        session = await ctx.__aenter__()
        await session.initialize()

        tools_result = await session.list_tools()
        tools = []
        for t in tools_result.tools:
            tool_info = {"name": t.name, "description": (t.description or "")[:300]}
            if t.inputSchema and "properties" in t.inputSchema:
                params = {}
                for k, v in t.inputSchema["properties"].items():
                    params[k] = {
                        "type": v.get("type", "unknown"),
                        "description": (v.get("description", ""))[:150],
                    }
                    if "enum" in v:
                        params[k]["enum"] = v["enum"]
                tool_info["parameters"] = params
                if "required" in t.inputSchema:
                    tool_info["required"] = t.inputSchema["required"]
            tools.append(tool_info)

        print(json.dumps({"tools": tools, "count": len(tools)}, ensure_ascii=False))

        # Clean shutdown
        try:
            await ctx.__aexit__(None, None, None)
        except Exception:
            pass
        try:
            await transport.__aexit__(None, None, None)
        except Exception:
            pass
    except Exception as e:
        print(json.dumps({"error": str(e)}))

asyncio.run(main())
`.trim();
}

export function createMcpTools(ctx: ToolContext) {
  return {
    listMcpTools: tool({
      description:
        "List all available tools on an MCP (Model Context Protocol) server. " +
        "IMPORTANT: You MUST call this tool before calling any MCP tool via bash to discover the correct tool names and their parameters. " +
        "Never guess or assume MCP tool names — always discover them first.",
      inputSchema: z.object({
        url: z
          .string()
          .describe("The MCP server URL (e.g. https://scp.intern-ai.org.cn/api/v1/mcp/2/DrugSDA-Tool)"),
        apiKey: z
          .string()
          .optional()
          .describe("Optional API key for the MCP server (sent as SCP-HUB-API-KEY header)"),
      }),
      execute: async ({ url, apiKey }) => {
        const script = buildListToolsPythonScript(url, apiKey);
        const result = await execInWorkspace(
          `python3 -c ${JSON.stringify(script)}`,
          ctx.validatedCwd,
          { timeout: 30_000 }
        );

        if (result.exitCode !== 0) {
          return {
            error: `Failed to list MCP tools: ${result.stderr || "unknown error"}`,
            exitCode: result.exitCode,
          };
        }

        try {
          const parsed = JSON.parse(result.stdout.trim());
          return parsed;
        } catch {
          return {
            error: "Failed to parse MCP tool listing response",
            raw: result.stdout.slice(0, 2000),
          };
        }
      },
    }),
  };
}
