/**
 * Default (non-privileged) agent tool names.
 * These are available to all skills/agents without explicit opt-in.
 */
export const ALL_TOOLS = [
  "bash",
  "readFile",
  "writeFile",
  "listDirectory",
  "grep",
  "searchArticles",
  "listMcpTools",
] as const;

/**
 * High-privilege Kubernetes tools; must be explicitly opted into.
 */
export const K8S_TOOLS = [
  "kubectl",
  "submitK8sJob",
] as const;

/**
 * Combined list of every known tool (non-privileged + K8s).
 * Used by UI components that need to display or select from the full set.
 */
export const EVERY_TOOL = [...ALL_TOOLS, ...K8S_TOOLS] as const;

export type ToolName =
  | (typeof ALL_TOOLS)[number]
  | (typeof K8S_TOOLS)[number];
