import type { DeepResearchArtifact } from "./types";

export function extractFinalReportText(artifact: DeepResearchArtifact): string {
  const content = artifact.content;
  const candidates = [
    content.report,
    content.messageToUser,
    content.text,
    content.content,
    content.summary,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return JSON.stringify(content, null, 2);
}

export function getLatestFinalReportArtifact(
  artifacts: DeepResearchArtifact[],
): DeepResearchArtifact | null {
  const finalReports = artifacts.filter((artifact) => artifact.artifactType === "final_report");
  if (finalReports.length === 0) {
    return null;
  }

  let latest = finalReports[0];
  for (const artifact of finalReports.slice(1)) {
    if (artifact.createdAt >= latest.createdAt) {
      latest = artifact;
    }
  }

  return latest;
}
