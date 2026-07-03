import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt } from "./agent-prompts";

describe("buildAgentSystemPrompt", () => {
  it("prefers the generic Kubernetes Job workflow without cluster-specific defaults", () => {
    const prompt = buildAgentSystemPrompt("/tmp/workspace");

    expect(prompt).toContain("prepareK8sJob");
    expect(prompt).toContain("runK8sJob");
    expect(prompt).toContain("prefer prepareK8sJob first");
    expect(prompt).not.toMatch(/A3 cluster|Ascend|MetaX|Muxi|沐曦/);
  });
});
