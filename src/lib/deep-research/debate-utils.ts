// =============================================================
// Deep Research — Debate Utility Functions (pure, no server deps)
// =============================================================
// Extracted from multi-agent-debate.ts to avoid pulling model-router
// and database dependencies into client bundles.

import type { DebateRecord } from "./types";

/**
 * Build a prompt overlay from debate results for injection into subsequent nodes.
 */
export function buildDebateOverlay(record: DebateRecord): string {
  if (record.rounds.length === 0) return "";

  let overlay = "\n\n## Multi-Agent Debate Results\n\n";

  overlay += `**Topic**: ${record.topic}\n`;
  overlay += `**Consensus Reached**: ${record.consensusReached ? "Yes" : "No"}\n`;
  overlay += `**Rounds**: ${record.totalRounds}\n\n`;

  overlay += `### Final Consensus\n${record.finalConsensus}\n\n`;

  if (record.keyInsights.length > 0) {
    overlay += "### Key Insights\n";
    for (const insight of record.keyInsights) {
      overlay += `- ${insight}\n`;
    }
    overlay += "\n";
  }

  if (record.actionItems.length > 0) {
    overlay += "### Recommended Actions\n";
    for (const action of record.actionItems) {
      overlay += `- ${action}\n`;
    }
    overlay += "\n";
  }

  // Include dissenting views from each round
  const allDissent = record.rounds.flatMap((r) => r.dissentingViews);
  const uniqueDissent = [...new Set(allDissent)];
  if (uniqueDissent.length > 0) {
    overlay += "### Dissenting Perspectives\n";
    for (const dissent of uniqueDissent.slice(0, 3)) {
      overlay += `- ${dissent.slice(0, 200)}\n`;
    }
    overlay += "\n";
  }

  overlay +=
    "Use these debate results to inform your research decisions and hypothesis refinement.\n";

  return overlay;
}

/**
 * Validate that a debate record contains meaningful output.
 */
export function isDebateRecordValid(record: DebateRecord): boolean {
  return (
    record.rounds.length > 0 &&
    record.keyInsights.length > 0 &&
    record.finalConsensus.length > 10
  );
}
