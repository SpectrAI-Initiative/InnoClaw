import { tool } from "ai";
import { z } from "zod";
import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  listDirectory as fsListDirectory,
} from "@/lib/files/filesystem";
import { TRUNCATE } from "@/lib/constants";
import { copyToResearchHistory } from "./research-history";
import type { ToolContext } from "./types";

export function createFileTools(ctx: ToolContext) {
  return {
    readFile: tool({
      description:
        "Read a file's content. Path can be relative to workspace root or absolute.",
      inputSchema: z.object({
        filePath: z.string().describe("Path to the file to read"),
      }),
      execute: async ({ filePath }) => {
        const resolved = ctx.resolvePath(filePath);
        const content = await fsReadFile(resolved);
        const truncated =
          content.length > TRUNCATE.FILE_CONTENT
            ? content.slice(0, TRUNCATE.FILE_CONTENT) + "\n... (truncated)"
            : content;
        return { content: truncated, path: resolved };
      },
    }),

    writeFile: tool({
      description:
        "Write content to a file. Creates parent directories if needed. Use for creating or overwriting files.",
      inputSchema: z.object({
        filePath: z.string().describe("Path to the file to write"),
        content: z.string().describe("The content to write"),
      }),
      execute: async ({ filePath, content }) => {
        const resolved = ctx.resolvePath(filePath);
        await fsWriteFile(resolved, content);
        // Best-effort copy to research history
        if (ctx.researchHistoryDir) {
          try {
            await copyToResearchHistory(resolved, ctx.validatedCwd, ctx.researchHistoryDir);
          } catch { /* don't fail the tool */ }
        }
        return {
          success: true,
          path: resolved,
          bytesWritten: content.length,
        };
      },
    }),

    listDirectory: tool({
      description:
        "List files and directories in a given path. Returns name, type, size, and modified time for each entry.",
      inputSchema: z.object({
        dirPath: z
          .string()
          .describe(
            "Path to the directory to list (defaults to workspace root if empty)"
          ),
      }),
      execute: async ({ dirPath }) => {
        const resolved = dirPath ? ctx.resolvePath(dirPath) : ctx.validatedCwd;
        const entries = await fsListDirectory(resolved);
        return {
          entries: entries.slice(0, TRUNCATE.DIR_ENTRIES).map((e) => ({
            name: e.name,
            type: e.type,
            size: e.size,
          })),
          total: entries.length,
          path: resolved,
        };
      },
    }),
  };
}
