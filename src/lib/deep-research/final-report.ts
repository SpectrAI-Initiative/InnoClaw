import {
  appendDeterministicReferencesSection,
  buildFinalReportCitationEntries,
} from "./prompts";
import type { DeepResearchArtifact } from "./types";

export interface FinalReportCitationCoverageSummary {
  availableCitationCount: number;
  citedCitationCount: number;
  minimumRequiredCitationCount: number;
  hasReferencesSection: boolean;
  meetsCoverage: boolean;
  revisedForCoverage: boolean;
}

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

export function extractFinalReportTextWithFallbackReferences(
  artifact: DeepResearchArtifact,
  artifacts: DeepResearchArtifact[],
): string {
  const reportText = extractFinalReportText(artifact);
  const preferredOutputLanguage = /[\u4e00-\u9fff]/.test(reportText) ? "zh" : "en";
  const citationEntries = buildFinalReportCitationEntries(artifacts);

  if (citationEntries.length === 0) {
    return reportText;
  }

  return appendDeterministicReferencesSection({
    reportText,
    citationEntries,
    preferredOutputLanguage,
  }).reportText;
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

export function extractFinalReportCitationCoverage(
  artifact: DeepResearchArtifact | null,
  artifacts?: DeepResearchArtifact[],
): FinalReportCitationCoverageSummary | null {
  if (!artifact) {
    return null;
  }

  const coverage = artifact.content.citationCoverage;
  if (!coverage || typeof coverage !== "object") {
    return null;
  }

  const record = coverage as Record<string, unknown>;
  if (
    typeof record.availableCitationCount !== "number" ||
    typeof record.citedCitationCount !== "number" ||
    typeof record.minimumRequiredCitationCount !== "number" ||
    typeof record.hasReferencesSection !== "boolean" ||
    typeof record.meetsCoverage !== "boolean"
  ) {
    return null;
  }

  const reportText = artifacts
    ? extractFinalReportTextWithFallbackReferences(artifact, artifacts)
    : extractFinalReportText(artifact);
  const hasReferencesSection = /(^|\n)#{1,6}\s*(references|reference trail|参考文献|参考文献与来源线索)\b/i.test(reportText);

  return {
    availableCitationCount: record.availableCitationCount,
    citedCitationCount: record.citedCitationCount,
    minimumRequiredCitationCount: record.minimumRequiredCitationCount,
    hasReferencesSection,
    meetsCoverage: record.citedCitationCount >= record.minimumRequiredCitationCount && hasReferencesSection,
    revisedForCoverage: artifact.content.revisedForCoverage === true,
  };
}
