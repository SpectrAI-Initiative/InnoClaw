import path from "path";
import { validatePath } from "@/lib/files/filesystem";
import { resolvePathWithinRoots } from "@/lib/files/canonical-path";
import { baseExecEnv } from "@/lib/utils/shell";
import { getK8sConfig } from "@/lib/cluster/config";
import { getK8sJobConfig } from "@/lib/cluster/job-profiles";
import { createFileTools } from "./file-tools";
import { createShellTools } from "./shell-tools";
import { createK8sTools } from "./k8s-tools";
import { createK8sJobTools } from "./k8s-job-tools";
import { createSearchTools } from "./search-tools";
import { createSkillTools } from "./skill-tools";
import { createMcpTools } from "./mcp-tools";
import { createResearchExecTools } from "./research-exec-tools";
import { formatTimestampForDir } from "./research-history";
import type { AgentToolAccess, ToolContext } from "./types";

export type { AgentToolAccess, ToolContext } from "./types";

export async function createAgentTools(
  workspaceCwd: string,
  allowedTools?: string[] | null,
  workspaceId?: string | null,
  sessionCreatedAt?: string | null,
  isLongAgent?: boolean,
  access?: AgentToolAccess,
) {
  const globallyValidatedCwd = validatePath(workspaceCwd);
  const workspaceBoundary = access?.workspaceRoot
    ? validatePath(access.workspaceRoot)
    : globallyValidatedCwd;
  const validatedCwd = resolvePathWithinRoots(globallyValidatedCwd, [
    workspaceBoundary,
  ]);

  // Load K8s config from DB (primary) with env fallback
  const k8sConfig = await getK8sConfig();
  const k8sJobConfig = await getK8sJobConfig();

  const rawKubeconfigPath =
    k8sConfig.kubeconfigPath ||
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
    return resolvePathWithinRoots(resolved, [workspaceBoundary]);
  }

  // Compute research history directory from session timestamp
  const researchHistoryDir = sessionCreatedAt
    ? path.join(validatedCwd, "history", formatTimestampForDir(sessionCreatedAt))
    : undefined;

  const ctx: ToolContext = {
    validatedCwd,
    resolvePath,
    kubeconfigPath,
    k8sConfig,
    k8sJobConfig,
    baseExecEnv,
    workspaceId,
    researchHistoryDir,
    isLongAgent,
  };

  const shellTools = createShellTools(ctx);
  const safeTools = {
    ...createFileTools(ctx),
    grep: shellTools.grep,
    ...createSearchTools(),
    ...createSkillTools(workspaceId),
  };
  const highRiskTools = access?.allowHighRisk === false
    ? {}
    : {
        bash: shellTools.bash,
        ...createK8sTools(ctx),
        ...createK8sJobTools(ctx),
        ...createMcpTools(ctx),
        ...createResearchExecTools(ctx),
      };
  const allTools = {
    ...safeTools,
    ...highRiskTools,
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
