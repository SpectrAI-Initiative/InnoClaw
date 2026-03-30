import { describe, expect, it } from "vitest";
import { extractFinalReportText, getLatestFinalReportArtifact } from "./final-report";
import type { DeepResearchArtifact } from "./types";

function createArtifact(
  overrides: Partial<DeepResearchArtifact>,
): DeepResearchArtifact {
  return {
    id: overrides.id ?? "artifact-1",
    sessionId: overrides.sessionId ?? "session-1",
    nodeId: overrides.nodeId ?? null,
    artifactType: overrides.artifactType ?? "final_report",
    title: overrides.title ?? "Final Report",
    content: overrides.content ?? {},
    provenance: overrides.provenance ?? null,
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? "2026-03-26T00:00:00.000Z",
  };
}

describe("final-report helpers", () => {
  it("returns the newest final report artifact when a session has multiple report revisions", () => {
    const older = createArtifact({
      id: "artifact-old",
      content: { report: "Short draft report" },
      createdAt: "2026-03-26T09:00:00.000Z",
    });
    const newer = createArtifact({
      id: "artifact-new",
      content: { report: "Detailed final report with full findings" },
      createdAt: "2026-03-26T09:30:00.000Z",
    });

    expect(getLatestFinalReportArtifact([older, newer])?.id).toBe("artifact-new");
  });

  it("extracts report text using the shared content priority", () => {
    const artifact = createArtifact({
      content: {
        messageToUser: "Short user message",
        report: "Detailed markdown report",
      },
    });

    expect(extractFinalReportText(artifact)).toBe("Detailed markdown report");
  });
});
