import { describe, expect, it } from "vitest";
import type { Skill } from "@/types";
import {
  getMatchingBuiltinCommands,
  getMatchingSkillsForSlashQuery,
  shouldAutocompleteCaptureEnter,
} from "./slash-command";

function createSkill(overrides: Partial<Skill>): Skill {
  return {
    id: "skill-1",
    workspaceId: null,
    name: "Summarize Notes",
    slug: "summarize",
    description: null,
    systemPrompt: "",
    steps: null,
    allowedTools: null,
    parameters: null,
    isEnabled: true,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("slash command helpers", () => {
  it("does not capture Enter when slash autocomplete has no matching skills", () => {
    const matches = getMatchingSkillsForSlashQuery(
      [createSkill({ slug: "summarize" })],
      "plain-message"
    );

    expect(matches).toEqual([]);
    expect(shouldAutocompleteCaptureEnter(true, matches)).toBe(false);
  });

  it("captures Enter when slash autocomplete has matching enabled skills", () => {
    const matches = getMatchingSkillsForSlashQuery(
      [createSkill({ slug: "summarize" })],
      "sum"
    );

    expect(matches).toHaveLength(1);
    expect(shouldAutocompleteCaptureEnter(true, matches)).toBe(true);
  });

  it("ignores disabled skills when building slash matches", () => {
    const matches = getMatchingSkillsForSlashQuery(
      [createSkill({ slug: "summarize", isEnabled: false })],
      "sum"
    );

    expect(matches).toEqual([]);
  });

  it("captures Enter for built-in commands even when no skills are loaded", () => {
    const skills = getMatchingSkillsForSlashQuery([], "");
    const builtins = getMatchingBuiltinCommands("");

    expect(skills).toEqual([]);
    expect(builtins.length).toBeGreaterThan(0);
    expect(shouldAutocompleteCaptureEnter(true, skills, builtins)).toBe(true);
  });

  it("captures Enter when only a built-in command matches the query", () => {
    const builtins = getMatchingBuiltinCommands("mem");

    expect(builtins.map((cmd) => cmd.slug)).toContain("memory");
    expect(shouldAutocompleteCaptureEnter(true, [], builtins)).toBe(true);
  });

  it("does not capture Enter when neither skills nor built-ins match", () => {
    const builtins = getMatchingBuiltinCommands("vari");

    expect(builtins).toEqual([]);
    expect(shouldAutocompleteCaptureEnter(true, [], builtins)).toBe(false);
  });

  it("does not capture Enter when autocomplete is hidden", () => {
    expect(
      shouldAutocompleteCaptureEnter(false, [], getMatchingBuiltinCommands(""))
    ).toBe(false);
  });
});
