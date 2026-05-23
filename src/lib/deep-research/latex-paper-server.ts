// =============================================================
// Deep Research — LaTeX Paper Server (server-only)
// =============================================================
// Server-only wrapper that ties LaTeX paper generation to the
// database-backed session store. Separated from final-report.ts
// to keep client bundles free of Node.js / DB dependencies.

import { getSession, getArtifacts } from "./event-store";
import {
  getLatestFinalReportArtifact,
  extractFinalReportTextWithFallbackReferences,
} from "./final-report";
import { buildLaTeXPaper } from "./latex-paper-builder";
import type { BuildLaTeXPaperResult, ConferenceName } from "./latex-paper-builder";

export {
  buildLaTeXPaper,
} from "./latex-paper-builder";

export type {
  BuildLaTeXPaperInput,
  BuildLaTeXPaperResult,
  ConferenceTemplate,
  ConferenceName,
} from "./latex-paper-builder";

export {
  getDefaultTemplate as getDefaultLaTeXTemplate,
  listAvailableTemplates,
} from "./latex-templates";

/**
 * Generate LaTeX paper from a session's final report artifact.
 */
export async function generateLaTeXFromSession(
  sessionId: string,
  conference?: ConferenceName,
): Promise<BuildLaTeXPaperResult | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const artifacts = await getArtifacts(sessionId);
  const finalReport = getLatestFinalReportArtifact(artifacts);
  if (!finalReport) return null;

  const reportText = extractFinalReportTextWithFallbackReferences(finalReport, artifacts);

  return buildLaTeXPaper({
    markdownReport: reportText,
    artifacts,
    conference,
    title: session.title,
  });
}
