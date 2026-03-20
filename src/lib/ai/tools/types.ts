import type { K8sConfig } from "@/lib/cluster/config";

/** Shared context passed to each tool factory. */
export interface ToolContext {
  /** Validated absolute path to the workspace root. */
  validatedCwd: string;
  /** Resolve a relative or absolute file path against the workspace and validate it. */
  resolvePath: (filePath: string) => string;
  /** Absolute path to the kubeconfig file. */
  kubeconfigPath: string;
  /** Full K8s cluster configuration loaded from DB (primary) with env fallback. */
  k8sConfig: K8sConfig;
  /** Base environment variables for exec calls. */
  baseExecEnv: NodeJS.ProcessEnv;
  /** Optional workspace ID for recording cluster operations. */
  workspaceId?: string | null;
  /** Absolute path to the research history directory for the current session (if available). */
  researchHistoryDir?: string;
  /** Whether the agent is in long-agent mode (tighter truncation to conserve context). */
  isLongAgent?: boolean;
}
