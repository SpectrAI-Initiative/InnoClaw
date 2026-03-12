import type { Skill, SkillStep, SkillParameter } from "@/types";
import { slugify } from "./slugify";
import { EVERY_TOOL } from "@/lib/ai/tool-names";

/**
 * Convert a Skill object to SKILL.md markdown format.
 *
 * Format:
 * ---
 * name: My Skill
 * slug: my-skill
 * description: ...
 * scope: global | workspace
 * allowed-tools: bash, readFile
 * parameters:
 *   - name: param1
 *     label: Param 1
 *     type: string
 *     required: true
 *     default: value
 *   - name: param2
 *     label: Param 2
 *     type: select
 *     required: false
 *     options: [a, b, c]
 * steps:
 *   - instruction: Do something
 *     tool-hint: bash
 *   - instruction: Do another thing
 * ---
 * System prompt content here...
 */
export function skillToMarkdown(skill: Partial<Skill> & { isGlobal?: boolean }): string {
  const lines: string[] = ["---"];

  if (skill.name) lines.push(`name: ${skill.name}`);
  if (skill.slug) lines.push(`slug: ${skill.slug}`);
  if (skill.description) lines.push(`description: ${skill.description}`);

  // Scope
  const isGlobal = skill.isGlobal !== undefined ? skill.isGlobal : !skill.workspaceId;
  lines.push(`scope: ${isGlobal ? "global" : "workspace"}`);

  // Allowed tools
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    lines.push(`allowed-tools: ${skill.allowedTools.join(", ")}`);
  }

  // Parameters
  if (skill.parameters && skill.parameters.length > 0) {
    lines.push("parameters:");
    for (const param of skill.parameters) {
      lines.push(`  - name: ${param.name}`);
      lines.push(`    label: ${param.label}`);
      lines.push(`    type: ${param.type}`);
      lines.push(`    required: ${param.required}`);
      if (param.defaultValue) {
        lines.push(`    default: ${param.defaultValue}`);
      }
      if (param.placeholder) {
        lines.push(`    placeholder: ${param.placeholder}`);
      }
      if (param.type === "select" && param.options && param.options.length > 0) {
        lines.push(`    options: [${param.options.join(", ")}]`);
      }
    }
  }

  // Steps
  if (skill.steps && skill.steps.length > 0) {
    lines.push("steps:");
    for (const step of skill.steps) {
      lines.push(`  - instruction: ${step.instruction}`);
      if (step.toolHint) {
        lines.push(`    tool-hint: ${step.toolHint}`);
      }
    }
  }

  lines.push("---");
  lines.push("");

  // System prompt body
  lines.push(skill.systemPrompt || "");

  return lines.join("\n");
}

/**
 * Generate a default SKILL.md template for new skill creation.
 */
export function getDefaultSkillTemplate(): string {
  return `---
name:
slug:
description:
scope: global
---

`;
}

/**
 * Parse a SKILL.md markdown string back into skill data.
 */
/** Canonical set of known tool names for validation. */
const KNOWN_TOOLS = new Set<string>(EVERY_TOOL);

export function markdownToSkillData(content: string): {
  name: string;
  slug: string;
  description: string;
  systemPrompt: string;
  isGlobal: boolean;
  steps: SkillStep[] | null;
  allowedTools: string[] | null;
  parameters: SkillParameter[] | null;
  warnings: string[];
} | null {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    // No frontmatter — return null (no skill metadata detected)
    return null;
  }

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  // Simple YAML value extraction
  const getValue = (key: string): string | undefined => {
    const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m?.[1]?.trim();
  };

  const warnings: string[] = [];

  const name = getValue("name") || "";
  const slug = getValue("slug") || slugify(name);
  const description = getValue("description") || "";
  const scope = getValue("scope") || "global";
  const isGlobal = scope !== "workspace";

  // Parse allowed-tools and validate against canonical tool names
  let allowedTools: string[] | null = null;
  const allowedToolsRaw = getValue("allowed-tools");
  if (allowedToolsRaw) {
    allowedTools = allowedToolsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowedTools.length === 0) {
      allowedTools = null;
    } else {
      const unknown = allowedTools.filter((t) => !KNOWN_TOOLS.has(t));
      if (unknown.length > 0) {
        warnings.push(
          `Unknown tool(s): ${unknown.join(", ")}. Valid tools: ${EVERY_TOOL.join(", ")}`
        );
      }
    }
  }

  // Parse parameters (multi-line YAML list)
  const parameters = parseParameters(frontmatter);

  // Parse steps (multi-line YAML list)
  const steps = parseSteps(frontmatter);

  return {
    name,
    slug,
    description,
    systemPrompt: body,
    isGlobal,
    steps,
    allowedTools,
    parameters,
    warnings,
  };
}

/** Parse the parameters block from YAML frontmatter */
function parseParameters(frontmatter: string): SkillParameter[] | null {
  const paramsMatch = frontmatter.match(/^parameters:\s*\n((?:[\t ]+.*\n?)*)/m);
  if (!paramsMatch) return null;

  const block = paramsMatch[1];
  const params: SkillParameter[] = [];
  let current: Partial<SkillParameter> | null = null;

  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("- name:")) {
      // Start a new parameter
      if (current && current.name) {
        params.push(finalizeParameter(current));
      }
      current = { name: trimmed.replace("- name:", "").trim() };
    } else if (current) {
      const kvMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)$/);
      if (kvMatch) {
        const [, key, val] = kvMatch;
        switch (key) {
          case "label":
            current.label = val;
            break;
          case "type":
            current.type = val as SkillParameter["type"];
            break;
          case "required":
            current.required = val === "true";
            break;
          case "default":
            current.defaultValue = val;
            break;
          case "placeholder":
            current.placeholder = val;
            break;
          case "options": {
            // Parse [a, b, c] format
            const optMatch = val.match(/^\[(.*)\]$/);
            if (optMatch) {
              current.options = optMatch[1]
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            }
            break;
          }
        }
      }
    }
  }

  // Don't forget the last parameter
  if (current && current.name) {
    params.push(finalizeParameter(current));
  }

  return params.length > 0 ? params : null;
}

function finalizeParameter(partial: Partial<SkillParameter>): SkillParameter {
  return {
    name: partial.name || "",
    label: partial.label || partial.name || "",
    type: partial.type || "string",
    required: partial.required !== false,
    defaultValue: partial.defaultValue,
    placeholder: partial.placeholder,
    options: partial.options,
  };
}

/** Parse the steps block from YAML frontmatter */
function parseSteps(frontmatter: string): SkillStep[] | null {
  const stepsMatch = frontmatter.match(/^steps:\s*\n((?:[\t ]+.*\n?)*)/m);
  if (!stepsMatch) return null;

  const block = stepsMatch[1];
  const steps: SkillStep[] = [];
  let current: Partial<SkillStep> | null = null;
  let order = 1;

  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("- instruction:")) {
      if (current && current.instruction) {
        steps.push({ order: order++, instruction: current.instruction, toolHint: current.toolHint });
      }
      current = { instruction: trimmed.replace("- instruction:", "").trim() };
    } else if (current) {
      const kvMatch = trimmed.match(/^tool-hint:\s*(.+)$/);
      if (kvMatch) {
        current.toolHint = kvMatch[1].trim();
      }
    }
  }

  // Don't forget the last step
  if (current && current.instruction) {
    steps.push({ order: order++, instruction: current.instruction, toolHint: current.toolHint });
  }

  return steps.length > 0 ? steps : null;
}
