import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt, buildProgressNarrationSection } from "./agent-prompts";

describe("buildAgentSystemPrompt", () => {
  it("prefers the generic Kubernetes Job workflow without cluster-specific defaults", () => {
    const prompt = buildAgentSystemPrompt("/tmp/workspace");

    expect(prompt).toContain("prepareK8sJob");
    expect(prompt).toContain("runK8sJob");
    expect(prompt).toContain("prefer prepareK8sJob first");
    expect(prompt).not.toMatch(/A3 cluster|Ascend|MetaX|Muxi|沐曦/);
  });
});

describe("buildProgressNarrationSection", () => {
  it("asks for step-by-step narration that names the skills used", () => {
    const section = buildProgressNarrationSection("en");

    expect(section).toContain("## Progress Narration");
    expect(section).toContain("Before each tool call");
    expect(section).toMatch(/name it explicitly/);
    expect(section).toContain("same language as the user's message");
  });

  it.each(["zh", "zh-CN", "ZH"])("requires Simplified Chinese when the UI locale is %s", (locale) => {
    const section = buildProgressNarrationSection(locale);

    expect(section).toContain("Simplified Chinese");
    expect(section).toContain("even when the user's message is in English");
    expect(section).not.toContain("same language as the user's message");
  });

  it("falls back to matching the user's language when no locale is given", () => {
    expect(buildProgressNarrationSection()).toContain("same language as the user's message");
  });
});

