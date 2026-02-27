import type { Skill } from "@/types";

/**
 * Sanitize a user-provided parameter value to prevent prompt injection.
 * Removes control characters and trims excessive length.
 */
function sanitizeParamValue(value: string): string {
  // Strip characters that could break prompt structure
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // remove control chars (keep \n \r \t)
    .slice(0, 10_000); // limit length
}

/**
 * Build a complete system prompt for executing a skill.
 * Combines the skill's custom system prompt, step instructions,
 * tool restrictions, and injected parameter values.
 */
export function buildSkillSystemPrompt(
  skill: Skill,
  cwd: string,
  paramValues: Record<string, string>
): string {
  // 1. Inject parameter values into the system prompt
  let resolvedPrompt = skill.systemPrompt;
  if (skill.parameters) {
    for (const param of skill.parameters) {
      const raw = paramValues[param.name] ?? param.defaultValue ?? "";
      const value = sanitizeParamValue(raw);
      resolvedPrompt = resolvedPrompt.replaceAll(`{{${param.name}}}`, value);
    }
  }

  // 2. Build step instructions if present
  let stepsBlock = "";
  if (skill.steps && skill.steps.length > 0) {
    const stepLines = skill.steps
      .sort((a, b) => a.order - b.order)
      .map((step) => {
        let line = `Step ${step.order}: ${step.instruction}`;
        if (step.toolHint) line += ` (use the "${step.toolHint}" tool)`;
        // Also inject parameters into step instructions
        if (skill.parameters) {
          for (const param of skill.parameters) {
            const raw =
              paramValues[param.name] ?? param.defaultValue ?? "";
            const value = sanitizeParamValue(raw);
            line = line.replaceAll(`{{${param.name}}}`, value);
          }
        }
        return line;
      })
      .join("\n");

    stepsBlock = `\n\n## Execution Steps\nFollow these steps in order:\n${stepLines}`;
  }

  // 3. Tool restriction notice
  let toolNotice = "";
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    toolNotice = `\n\n## Tool Restrictions\nYou may ONLY use these tools: ${skill.allowedTools.join(", ")}. Do NOT use any other tools.`;
  }

  return `You are an expert software engineer working in the user's workspace at: ${cwd}

## Skill: ${skill.name}
${skill.description || ""}

${resolvedPrompt}${stepsBlock}${toolNotice}

Respond in the same language as the user's message.`;
}
