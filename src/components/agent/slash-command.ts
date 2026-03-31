import type { Skill } from "@/types";

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

export function shouldAutocompleteCaptureEnter(
  showAutocomplete: boolean,
  matchingSkills: Skill[]
): boolean {
  return showAutocomplete && matchingSkills.length > 0;
}
