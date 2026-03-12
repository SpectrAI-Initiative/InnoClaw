import { describe, it, expect } from "vitest";
import { skillToMarkdown, markdownToSkillData, getDefaultSkillTemplate } from "./skill-md";
import type { Skill } from "@/types";

describe("skill-md utilities", () => {
  describe("getDefaultSkillTemplate", () => {
    it("should return a valid template with frontmatter", () => {
      const template = getDefaultSkillTemplate();
      expect(template).toContain("---");
      expect(template).toContain("name:");
      expect(template).toContain("scope: global");
    });

    it("should be parseable by markdownToSkillData", () => {
      const template = getDefaultSkillTemplate();
      const result = markdownToSkillData(template);
      expect(result).not.toBeNull();
      expect(result!.isGlobal).toBe(true);
    });
  });

  describe("markdownToSkillData", () => {
    it("should return null for content without frontmatter", () => {
      expect(markdownToSkillData("no frontmatter here")).toBeNull();
      expect(markdownToSkillData("")).toBeNull();
      expect(markdownToSkillData("just some text\nwith lines")).toBeNull();
    });

    it("should parse basic frontmatter and body", () => {
      const md = `---
name: Test Skill
slug: test-skill
description: A test skill
scope: global
---

This is the system prompt.`;
      const result = markdownToSkillData(md);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Test Skill");
      expect(result!.slug).toBe("test-skill");
      expect(result!.description).toBe("A test skill");
      expect(result!.isGlobal).toBe(true);
      expect(result!.systemPrompt).toBe("This is the system prompt.");
      expect(result!.warnings).toEqual([]);
    });

    it("should handle workspace scope", () => {
      const md = `---
name: WS Skill
scope: workspace
---

prompt`;
      const result = markdownToSkillData(md);
      expect(result!.isGlobal).toBe(false);
    });

    it("should auto-generate slug from name when slug is missing", () => {
      const md = `---
name: My Awesome Skill
description: test
---

prompt`;
      const result = markdownToSkillData(md);
      expect(result!.slug).toBe("my-awesome-skill");
    });

    it("should return empty body when no content after frontmatter", () => {
      const md = `---
name: No Body
---
`;
      const result = markdownToSkillData(md);
      expect(result).not.toBeNull();
      expect(result!.systemPrompt).toBe("");
    });

    it("should parse allowed-tools as comma-separated list", () => {
      const md = `---
name: Tool Skill
allowed-tools: bash, readFile, writeFile
---

prompt`;
      const result = markdownToSkillData(md);
      expect(result!.allowedTools).toEqual(["bash", "readFile", "writeFile"]);
      expect(result!.warnings).toEqual([]);
    });

    it("should warn about unknown tools", () => {
      const md = `---
name: Bad Tools
allowed-tools: bash, unknownTool, fakeExec
---

prompt`;
      const result = markdownToSkillData(md);
      expect(result!.allowedTools).toEqual(["bash", "unknownTool", "fakeExec"]);
      expect(result!.warnings.length).toBe(1);
      expect(result!.warnings[0]).toContain("unknownTool");
      expect(result!.warnings[0]).toContain("fakeExec");
      // The warning message lists unknown tools only, not valid ones in the "Unknown tool(s):" prefix
      expect(result!.warnings[0]).toMatch(/^Unknown tool\(s\): unknownTool, fakeExec\./);
    });

    it("should return null allowedTools for empty allowed-tools value", () => {
      const md = `---
name: Empty Tools
allowed-tools:
---

prompt`;
      const result = markdownToSkillData(md);
      expect(result!.allowedTools).toBeNull();
    });

    it("should parse parameters block", () => {
      const md = `---
name: Param Skill
parameters:
  - name: query
    label: Search Query
    type: string
    required: true
    default: hello
    placeholder: Enter query
  - name: format
    label: Output Format
    type: select
    required: false
    options: [json, csv, text]
---

prompt`;
      const result = markdownToSkillData(md);
      expect(result!.parameters).not.toBeNull();
      expect(result!.parameters!.length).toBe(2);

      const p1 = result!.parameters![0];
      expect(p1.name).toBe("query");
      expect(p1.label).toBe("Search Query");
      expect(p1.type).toBe("string");
      expect(p1.required).toBe(true);
      expect(p1.defaultValue).toBe("hello");
      expect(p1.placeholder).toBe("Enter query");

      const p2 = result!.parameters![1];
      expect(p2.name).toBe("format");
      expect(p2.type).toBe("select");
      expect(p2.required).toBe(false);
      expect(p2.options).toEqual(["json", "csv", "text"]);
    });

    it("should parse steps block with order", () => {
      const md = `---
name: Step Skill
steps:
  - instruction: First step
    tool-hint: bash
  - instruction: Second step
  - instruction: Third step
    tool-hint: readFile
---

prompt`;
      const result = markdownToSkillData(md);
      expect(result!.steps).not.toBeNull();
      expect(result!.steps!.length).toBe(3);

      expect(result!.steps![0]).toEqual({ order: 1, instruction: "First step", toolHint: "bash" });
      expect(result!.steps![1]).toEqual({ order: 2, instruction: "Second step", toolHint: undefined });
      expect(result!.steps![2]).toEqual({ order: 3, instruction: "Third step", toolHint: "readFile" });
    });

    it("should return null for parameters/steps when not present", () => {
      const md = `---
name: Simple
---

prompt`;
      const result = markdownToSkillData(md);
      expect(result!.parameters).toBeNull();
      expect(result!.steps).toBeNull();
    });
  });

  describe("skillToMarkdown", () => {
    it("should serialize a basic skill to markdown", () => {
      const skill: Partial<Skill> & { isGlobal?: boolean } = {
        name: "Test Skill",
        slug: "test-skill",
        description: "A test",
        systemPrompt: "Do things",
        isGlobal: true,
      };
      const md = skillToMarkdown(skill);
      expect(md).toContain("name: Test Skill");
      expect(md).toContain("slug: test-skill");
      expect(md).toContain("description: A test");
      expect(md).toContain("scope: global");
      expect(md).toContain("Do things");
    });

    it("should include allowed tools", () => {
      const skill: Partial<Skill> & { isGlobal?: boolean } = {
        name: "Tool Skill",
        allowedTools: ["bash", "readFile"],
        systemPrompt: "prompt",
      };
      const md = skillToMarkdown(skill);
      expect(md).toContain("allowed-tools: bash, readFile");
    });

    it("should include parameters", () => {
      const skill: Partial<Skill> & { isGlobal?: boolean } = {
        name: "Param Skill",
        parameters: [
          { name: "q", label: "Query", type: "string", required: true },
        ],
        systemPrompt: "prompt",
      };
      const md = skillToMarkdown(skill);
      expect(md).toContain("parameters:");
      expect(md).toContain("- name: q");
      expect(md).toContain("label: Query");
    });

    it("should include steps", () => {
      const skill: Partial<Skill> & { isGlobal?: boolean } = {
        name: "Step Skill",
        steps: [
          { order: 1, instruction: "Do thing", toolHint: "bash" },
          { order: 2, instruction: "Do other thing" },
        ],
        systemPrompt: "prompt",
      };
      const md = skillToMarkdown(skill);
      expect(md).toContain("steps:");
      expect(md).toContain("- instruction: Do thing");
      expect(md).toContain("tool-hint: bash");
      expect(md).toContain("- instruction: Do other thing");
    });

    it("should use workspace scope when isGlobal is false", () => {
      const skill: Partial<Skill> & { isGlobal?: boolean } = {
        name: "WS",
        isGlobal: false,
        systemPrompt: "prompt",
      };
      const md = skillToMarkdown(skill);
      expect(md).toContain("scope: workspace");
    });
  });

  describe("round-trip conversion", () => {
    it("should preserve data through serialize → parse cycle", () => {
      const skill: Partial<Skill> & { isGlobal?: boolean } = {
        name: "Round Trip",
        slug: "round-trip",
        description: "Test round trip",
        systemPrompt: "System prompt content\nwith multiple lines",
        isGlobal: true,
        allowedTools: ["bash", "readFile"],
        parameters: [
          { name: "input", label: "Input", type: "string", required: true, defaultValue: "default" },
        ],
        steps: [
          { order: 1, instruction: "Step one", toolHint: "bash" },
          { order: 2, instruction: "Step two" },
        ],
      };

      const md = skillToMarkdown(skill);
      const parsed = markdownToSkillData(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.name).toBe("Round Trip");
      expect(parsed!.slug).toBe("round-trip");
      expect(parsed!.description).toBe("Test round trip");
      expect(parsed!.systemPrompt).toBe("System prompt content\nwith multiple lines");
      expect(parsed!.isGlobal).toBe(true);
      expect(parsed!.allowedTools).toEqual(["bash", "readFile"]);
      expect(parsed!.parameters!.length).toBe(1);
      expect(parsed!.parameters![0].name).toBe("input");
      expect(parsed!.parameters![0].defaultValue).toBe("default");
      expect(parsed!.steps!.length).toBe(2);
      expect(parsed!.steps![0].instruction).toBe("Step one");
      expect(parsed!.steps![0].toolHint).toBe("bash");
      expect(parsed!.steps![1].instruction).toBe("Step two");
      expect(parsed!.warnings).toEqual([]);
    });

    it("should preserve select parameter options through round-trip", () => {
      const skill: Partial<Skill> & { isGlobal?: boolean } = {
        name: "Select Test",
        systemPrompt: "prompt",
        parameters: [
          { name: "fmt", label: "Format", type: "select", required: false, options: ["json", "csv"] },
        ],
      };

      const md = skillToMarkdown(skill);
      const parsed = markdownToSkillData(md);

      expect(parsed!.parameters![0].type).toBe("select");
      expect(parsed!.parameters![0].options).toEqual(["json", "csv"]);
    });
  });
});
