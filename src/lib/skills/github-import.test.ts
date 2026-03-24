import { describe, expect, it } from "vitest";
import {
  buildGitHubBranchCandidates,
  buildGitHubSingleFileCandidates,
  getGitHubFallbackSlug,
  isGitHubUrl,
  parseGitHubUrl,
} from "./github-import";

describe("github-import helpers", () => {
  it("recognizes repository URLs", () => {
    expect(isGitHubUrl("https://github.com/InternScience/scp")).toBe(true);
    expect(isGitHubUrl("https://raw.githubusercontent.com/InternScience/scp/main/SKILL.md")).toBe(true);
    expect(isGitHubUrl("https://example.com/skill.json")).toBe(false);
  });

  it("parses a repository root URL", () => {
    expect(parseGitHubUrl("https://github.com/InternScience/scp")).toEqual({
      owner: "InternScience",
      repo: "scp",
      branch: null,
      path: "",
      source: "repo",
    });
  });

  it("parses tree and blob URLs", () => {
    expect(
      parseGitHubUrl(
        "https://github.com/InternScience/scp/tree/main/skills/admet"
      )
    ).toEqual({
      owner: "InternScience",
      repo: "scp",
      branch: "main",
      path: "skills/admet",
      source: "tree",
    });

    expect(
      parseGitHubUrl(
        "https://github.com/InternScience/scp/blob/main/skills/admet/SKILL.md"
      )
    ).toEqual({
      owner: "InternScience",
      repo: "scp",
      branch: "main",
      path: "skills/admet/SKILL.md",
      source: "blob",
    });
  });

  it("parses raw GitHub URLs", () => {
    expect(
      parseGitHubUrl(
        "https://raw.githubusercontent.com/InternScience/scp/main/skills/admet/SKILL.md"
      )
    ).toEqual({
      owner: "InternScience",
      repo: "scp",
      branch: "main",
      path: "skills/admet/SKILL.md",
      source: "raw",
    });
  });

  it("builds branch fallback candidates without duplicates", () => {
    expect(buildGitHubBranchCandidates(null, "main")).toEqual(["main", "master"]);
    expect(buildGitHubBranchCandidates("dev", "main")).toEqual(["dev", "main", "master"]);
  });

  it("builds single-file candidates for repo, directory, and file URLs", () => {
    expect(buildGitHubSingleFileCandidates("")).toEqual(["SKILL.md"]);
    expect(buildGitHubSingleFileCandidates("skills/admet")).toEqual(["skills/admet/SKILL.md"]);
    expect(buildGitHubSingleFileCandidates("skills/admet/SKILL.md")).toEqual([
      "skills/admet/SKILL.md",
    ]);
  });

  it("derives fallback slugs from the final path segment", () => {
    expect(getGitHubFallbackSlug("", "scp")).toBe("scp");
    expect(getGitHubFallbackSlug("skills/admet/SKILL.md", "scp")).toBe("admet");
    expect(getGitHubFallbackSlug("commands/review.md", "scp")).toBe("review");
  });
});
