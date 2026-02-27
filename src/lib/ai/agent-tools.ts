import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import path from "path";
import {
  validatePath,
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  listDirectory as fsListDirectory,
} from "@/lib/files/filesystem";

export function createAgentTools(
  workspaceCwd: string,
  allowedTools?: string[] | null
) {
  const validatedCwd = validatePath(workspaceCwd);

  /**
   * Resolves a file path relative to the workspace and validates it against
   * allowed workspace roots.
   * @throws {Error} If the resolved path is outside the allowed workspace roots
   * or contains invalid characters (e.g. null bytes).
   */
  function resolvePath(filePath: string): string {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(validatedCwd, filePath);
    return validatePath(resolved);
  }

  const allTools = {
    bash: tool({
      description:
        "Execute a shell command in the workspace directory. Use for running builds, tests, git operations, package management, etc.",
      inputSchema: z.object({
        command: z.string().describe("The shell command to execute"),
      }),
      execute: async ({ command }) => {
        return new Promise<{
          stdout: string;
          stderr: string;
          exitCode: number;
        }>((resolve) => {
          exec(
            command,
            {
              cwd: validatedCwd,
              timeout: 30_000,
              maxBuffer: 1024 * 1024,
              env: {
                PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
                HOME: process.env.HOME || "/tmp",
                NODE_ENV: process.env.NODE_ENV || "production",
                LANG: process.env.LANG || "en_US.UTF-8",
                TERM: "dumb",
              },
            },
            (error, stdout, stderr) => {
              resolve({
                stdout: (stdout || "").slice(0, 10000),
                stderr: (stderr || "").slice(0, 5000),
                exitCode: error?.code ?? (error ? 1 : 0),
              });
            }
          );
        });
      },
    }),

    readFile: tool({
      description:
        "Read a file's content. Path can be relative to workspace root or absolute.",
      inputSchema: z.object({
        filePath: z.string().describe("Path to the file to read"),
      }),
      execute: async ({ filePath }) => {
        const resolved = resolvePath(filePath);
        const content = await fsReadFile(resolved);
        const truncated =
          content.length > 50000
            ? content.slice(0, 50000) + "\n... (truncated)"
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
        const resolved = resolvePath(filePath);
        await fsWriteFile(resolved, content);
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
        const resolved = dirPath ? resolvePath(dirPath) : validatedCwd;
        const entries = await fsListDirectory(resolved);
        return {
          entries: entries.slice(0, 200).map((e) => ({
            name: e.name,
            type: e.type,
            size: e.size,
          })),
          total: entries.length,
          path: resolved,
        };
      },
    }),

    grep: tool({
      description:
        "Search for a regex pattern in files. Returns matching lines with file paths and line numbers.",
      inputSchema: z.object({
        pattern: z.string().describe("Regex pattern to search for"),
        path: z
          .string()
          .optional()
          .describe(
            "Directory or file to search in (defaults to workspace root)"
          ),
        include: z
          .string()
          .optional()
          .describe("File glob pattern to include, e.g. '*.ts'"),
      }),
      execute: async ({ pattern, path: searchPath, include }) => {
        const target = searchPath ? resolvePath(searchPath) : validatedCwd;
        validatePath(target);

        let cmd = `grep -rn --max-count=50`;
        if (include) cmd += ` --include='${include.replace(/'/g, "'\\''")}'`;
        cmd += ` -- '${pattern.replace(/'/g, "'\\''")}' '${target.replace(/'/g, "'\\''")}'`;

        return new Promise<{
          matches: string;
          exitCode: number;
        }>((resolve) => {
          exec(
            cmd,
            {
              cwd: validatedCwd,
              timeout: 15_000,
              maxBuffer: 512 * 1024,
            },
            (error, stdout, stderr) => {
              resolve({
                matches: (stdout || "").slice(0, 20000) || (stderr || ""),
                exitCode: error?.code ?? (error ? 1 : 0),
              });
            }
          );
        });
      },
    }),
  };

  // Filter tools if allowedTools is specified
  if (allowedTools === undefined || allowedTools === null) {
    return allTools;
  }

  if (allowedTools.length === 0) {
    return {};
  }

  // Validate that all requested tools exist
  const allToolNames = new Set(Object.keys(allTools));
  const unknownTools = allowedTools.filter((name) => !allToolNames.has(name));

  if (unknownTools.length > 0) {
    console.warn(
      `[agent-tools] Unknown tools in allowedTools: ${unknownTools.join(", ")}. Known tools: ${Array.from(allToolNames).join(", ")}`
    );
  }

  const filtered: Record<string, (typeof allTools)[keyof typeof allTools]> =
    {};
  for (const name of allowedTools) {
    if (name in allTools) {
      filtered[name] = allTools[name as keyof typeof allTools];
    }
  }
  return filtered;
}
