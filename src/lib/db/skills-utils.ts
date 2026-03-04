/**
 * Shared utilities for parsing skill database rows.
 */

import type { Skill } from "@/types";

export function parseSkillRow(row: Record<string, unknown>): Skill {
  return {
    ...(row as Omit<Skill, "steps" | "allowedTools" | "parameters">),
    steps: typeof row.steps === "string" ? JSON.parse(row.steps) : null,
    allowedTools:
      typeof row.allowedTools === "string"
        ? JSON.parse(row.allowedTools)
        : null,
    parameters:
      typeof row.parameters === "string"
        ? JSON.parse(row.parameters)
        : null,
  };
}
