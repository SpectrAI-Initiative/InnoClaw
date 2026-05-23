// =============================================================
// Deep Research — Repair Utility Functions (pure, no server deps)
// =============================================================
// Extracted from experiment-repair.ts to avoid pulling model-router
// and database dependencies into client bundles.

import type { RepairCycleResult } from "./types";

/**
 * Generate a prompt overlay for the repair context.
 * Injects repair history into the worker prompt for the next attempt.
 */
export function buildRepairPromptOverlay(
  cycleHistory: RepairCycleResult[],
): string {
  if (cycleHistory.length === 0) return "";

  let overlay = "\n\n## Previous Repair Attempts\n\n";

  for (const cycle of cycleHistory) {
    overlay += `### Cycle ${cycle.cycle}\n`;
    overlay += `- **Diagnosis**: ${cycle.diagnosis.description}\n`;
    overlay += `- **Root Cause**: ${cycle.diagnosis.rootCause}\n`;
    if (cycle.repairApplied) {
      overlay += `- **Applied Fix**: ${cycle.repairDescription}\n`;
      overlay += `- **Quality After**: ${(cycle.qualityAfterRepair * 100).toFixed(0)}%\n`;
    }
    overlay += "\n";
  }

  overlay +=
    "Use this repair history to avoid repeating the same mistakes. ";
  overlay +=
    "Apply the suggested fixes and parameter adjustments in your next attempt.\n";

  return overlay;
}
