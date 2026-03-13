import path from "path";
import { validatePath } from "@/lib/files/filesystem";
import { baseExecEnv } from "@/lib/utils/shell";
import { createFileTools } from "./file-tools";
import { createShellTools } from "./shell-tools";
import { createK8sTools } from "./k8s-tools";
import { createSearchTools } from "./search-tools";
import { createSkillTools } from "./skill-tools";
import { createMcpTools } from "./mcp-tools";
import { formatTimestampForDir } from "./research-history";
import type { ToolContext } from "./types";

export type { ToolContext } from "./types";

export function createAgentTools(
  workspaceCwd: string,
  allowedTools?: string[] | null,
  workspaceId?: string | null,
  sessionCreatedAt?: string | null
) {
  const validatedCwd = validatePath(workspaceCwd);

  const rawKubeconfigPath =
    process.env.KUBECONFIG_PATH ||
    path.join(process.cwd(), "config", "d_k8s");
  const kubeconfigPath = path.isAbsolute(rawKubeconfigPath)
    ? rawKubeconfigPath
    : path.resolve(process.cwd(), rawKubeconfigPath);

  /**
   * Resolves a file path relative to the workspace and validates it against
   * allowed workspace roots.
   */
  function resolvePath(filePath: string): string {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(validatedCwd, filePath);
    return validatePath(resolved);
  }

  // Compute research history directory from session timestamp
  const researchHistoryDir = sessionCreatedAt
    ? path.join(validatedCwd, "history", formatTimestampForDir(sessionCreatedAt))
    : undefined;

  const ctx: ToolContext = {
    validatedCwd,
    resolvePath,
    kubeconfigPath,
    baseExecEnv,
    workspaceId,
    researchHistoryDir,
  };

  const allTools = {
    ...createShellTools(ctx),
    ...createFileTools(ctx),
    ...createK8sTools(ctx),
    ...createSearchTools(),
    ...createSkillTools(workspaceId),
    ...createMcpTools(ctx),
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
