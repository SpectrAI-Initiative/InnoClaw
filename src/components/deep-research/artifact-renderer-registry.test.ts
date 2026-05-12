import { describe, expect, it } from "vitest";
import {
  getMarkdownArtifactText,
  resolveArtifactRendererKind,
} from "./artifact-renderer-registry";

describe("artifact-renderer-registry", () => {
  it("maps canonical artifact types to renderer kinds", () => {
    expect(resolveArtifactRendererKind("evidence_card", {})).toBe("evidence_card");
    expect(resolveArtifactRendererKind("checkpoint", {})).toBe("checkpoint");
    expect(resolveArtifactRendererKind("final_report", {})).toBe("final_report");
  });

  it("preserves the existing markdown field priority", () => {
    expect(getMarkdownArtifactText({
      report: "# Final Report",
      text: "fallback",
    })).toBe("fallback");
  });
});
