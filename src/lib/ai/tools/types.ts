/** Shared context passed to each tool factory. */
export interface ToolContext {
  /** Validated absolute path to the workspace root. */
  validatedCwd: string;
  /** Resolve a relative or absolute file path against the workspace and validate it. */
  resolvePath: (filePath: string) => string;
  /** Absolute path to the kubeconfig file. */
  kubeconfigPath: string;
  /** Base environment variables for exec calls. */
  baseExecEnv: NodeJS.ProcessEnv;
  /** Optional workspace ID for recording cluster operations. */
  workspaceId?: string | null;
  /** Absolute path to the research history directory for the current session (if available). */
  researchHistoryDir?: string;
}
