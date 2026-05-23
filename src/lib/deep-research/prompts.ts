export { buildMainBrainSystemPrompt } from "./prompt-builders/main-brain-prompt";
export {
  buildCheckpointPrompt,
  buildConfirmationInterpretationPrompt,
} from "./prompt-builders/checkpoint-prompt";
export {
  buildWorkerSystemPrompt,
  buildEvidenceGatherPrompt,
  buildValidationPlanPrompt,
} from "./prompt-builders/worker-prompts";
export { buildReviewerSystemPrompt } from "./prompt-builders/review-prompt";
export {
  analyzeFinalReportCitationCoverage,
  appendDeterministicReferencesSection,
  assembleFinalReportFromSections,
  buildFinalReportCitationEntries,
  buildFinalReportCoverageRevisionPrompt,
  buildFinalReportPromptBundle,
  buildFinalReportPlannerSystemPrompt,
  buildFinalReportSectionCitationRevisionPrompt,
  buildFinalReportSectionDraftPrompt,
  buildFinalReportSectionPlanPrompt,
  buildFinalReportSystemPrompt,
  buildFinalReportPrompt,
  extractRecognizedCitationKeys,
  getFinalReportDraftingOrder,
  getRelevantChapterPacketsForSection,
  getMinimumRequiredCitationCount,
  isSurveyLikeResearchRequest,
  normalizeFinalReportSectionPlan,
} from "./prompt-builders/final-report-prompt";

// =============================================================
// New Feature Prompt Builders (from AutoResearchClaw)
// =============================================================
// Pure utility functions are re-exported from dependency-free *-utils.ts files.
// Server-only functions (LLM calls, filesystem, child_process) are NOT
// re-exported here. Import them directly from their source files:
//   - detectHardware, buildHardwarePromptBlock → ./hardware-detection
//   - runExperimentRepair → ./experiment-repair
//   - runMultiAgentDebate → ./multi-agent-debate
//   - makeResearchDecision → ./pivot-refine-loop
//   - EvolutionStore, getEvolutionStore, harvestSessionLessons → ./evolution-store

export { buildDebateOverlay, isDebateRecordValid } from "./debate-utils";
export { buildPivotRefineOverlay, getArtifactVersionSuffix, tryQuickDecision } from "./pivot-refine-utils";
export { buildRepairPromptOverlay } from "./repair-utils";
export { runSentinelChecks, shouldAutoPause } from "./sentinel-watchdog";
export { verifyClaims, extractFabricationFlags, isVerificationAcceptable } from "./claim-verification";
