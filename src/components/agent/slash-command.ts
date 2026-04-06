import type { Skill } from "@/types";

/** Built-in slash commands that are handled client-side (not DB skills). */
export interface BuiltinCommand {
  slug: string;
  name: string;
  description: string;
}

export const BUILTIN_COMMANDS: BuiltinCommand[] = [
  { slug: "compact", name: "Compact", description: "Compress conversation context" },
  { slug: "cost", name: "Cost", description: "Toggle session cost display" },
  { slug: "memory", name: "Memory", description: "Open memory panel" },
  { slug: "remember", name: "Remember", description: "Save a note to memory" },
  { slug: "dream", name: "Dream", description: "Consolidate memory logs" },
];

export function getMatchingSkillsForSlashQuery(
  skills: Skill[],
  query: string
): Skill[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return skills.filter((skill) => skill.isEnabled);
  }

  return skills.filter(
    (skill) =>
      skill.isEnabled &&
      (skill.slug.includes(normalizedQuery) ||
        skill.name.toLowerCase().includes(normalizedQuery))
  );
}

export function getMatchingBuiltinCommands(query: string): BuiltinCommand[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return BUILTIN_COMMANDS;
  return BUILTIN_COMMANDS.filter(
    (cmd) =>
      cmd.slug.includes(normalizedQuery) ||
      cmd.name.toLowerCase().includes(normalizedQuery)
  );
}

export function shouldAutocompleteCaptureEnter(
  showAutocomplete: boolean,
  matchingSkills: Skill[]
): boolean {
  return showAutocomplete && matchingSkills.length > 0;
}
