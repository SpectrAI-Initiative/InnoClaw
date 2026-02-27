/**
 * Canonical list of agent tool names.
 * Single source of truth used by skill forms, steps editors, and agent tools.
 */
export const ALL_TOOLS = [
  "bash",
  "readFile",
  "writeFile",
  "listDirectory",
  "grep",
] as const;

export type ToolName = (typeof ALL_TOOLS)[number];
