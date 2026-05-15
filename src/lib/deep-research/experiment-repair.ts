// =============================================================
// Deep Research — Experiment Self-Healing Repair Loop
// =============================================================
// Diagnose experiment failures, generate fixes, and re-run.
// Ported from AutoResearchClaw's experiment_repair.py.
//
// Cycle: diagnose → fix → re-run → assess quality → repeat (up to max cycles)

import { generateText } from "ai";
import type { LanguageModel } from "ai";
import { getModelForRole } from "./model-router";
import { safeParseJson } from "./json-response";
import type {
  DeepResearchArtifact,
  DeepResearchNode,
  ExperimentDiagnosis,
  RepairCycleResult,
  ExperimentRepairResult,
  DeficiencyType,
} from "./types";
import { DEFAULT_EXPERIMENT_REPAIR_CONFIG } from "./config-types";
import type { ExperimentRepairConfig } from "./config-types";
import { buildRepairPromptOverlay as _buildRepairPromptOverlay } from "./repair-utils";

// =============================================================
// Diagnosis
// =============================================================

/**
 * Diagnose what went wrong in an experiment from its output artifacts.
 */
function diagnoseFailure(
  stepResults: DeepResearchArtifact[],
  experimentResults: DeepResearchArtifact[],
): ExperimentDiagnosis {
  const allContent = [...stepResults, ...experimentResults]
    .map((a) => JSON.stringify(a.content ?? {}))
    .join("\n")
    .toLowerCase();

  // Check for NaN/Inf
  if (/\bnan\b/.test(allContent) || /\binf(?:inity)?\b/.test(allContent)) {
    return {
      deficiencyType: "nan_inf",
      description: "NaN or Infinity values detected in experiment output",
      affectedFiles: [],
      errorMessages: ["NaN/Inf detected in experiment results"],
      rootCause:
        "Numerical instability — possibly division by zero, log of negative number, or overflow",
      fixable: true,
    };
  }

  // Check for runtime errors
  if (
    /\berror\b/.test(allContent) ||
    /\bexception\b/.test(allContent) ||
    /\btraceback\b/.test(allContent)
  ) {
    return {
      deficiencyType: "runtime_error",
      description: "Runtime error detected in experiment execution",
      affectedFiles: [],
      errorMessages: ["Runtime error/exception in experiment code"],
      rootCause: "Code error — likely a bug in the experiment implementation",
      fixable: true,
    };
  }

  // Check for missing output
  const hasMetricOutput =
    /\b(accuracy|loss|f1|precision|recall|bleu|rouge|mae|mse|rmse|auc|perplexity)\b/.test(
      allContent,
    );

  if (!hasMetricOutput && experimentResults.length > 0) {
    return {
      deficiencyType: "missing_output",
      description: "Experiment completed but no recognizable metrics found",
      affectedFiles: [],
      errorMessages: ["No standard metrics detected in experiment output"],
      rootCause:
        "Experiment may have run but didn't produce expected metric values",
      fixable: true,
    };
  }

  // Check for low performance / incomplete
  if (allContent.includes("incomplete") || allContent.includes("interrupted")) {
    return {
      deficiencyType: "incomplete",
      description: "Experiment appears to have been interrupted or incomplete",
      affectedFiles: [],
      errorMessages: ["Experiment did not complete successfully"],
      rootCause: "Possible timeout, resource exhaustion, or premature termination",
      fixable: true,
    };
  }

  // Default: no clear deficiency found
  return {
    deficiencyType: "other",
    description: "No specific deficiency pattern detected",
    affectedFiles: [],
    errorMessages: [],
    rootCause: "Unknown — manual review recommended",
    fixable: false,
  };
}

// =============================================================
// Repair Suggestion
// =============================================================

const REPAIR_SYSTEM_PROMPT = `You are an expert experiment repair specialist. 
Given a diagnosis of an experiment failure, suggest concrete code fixes.

For each deficiency type, follow these guidelines:
- nan_inf: Add numerical stability checks (clipping, epsilon values, safe division)
- runtime_error: Fix the specific error, add proper error handling
- missing_output: Ensure metrics are computed and printed, check output format
- low_performance: Suggest hyperparameter tuning, architecture changes, or data preprocessing
- incomplete: Add checkpointing, increase timeout, reduce batch size

Output a JSON object with:
{
  "repairDescription": "Brief description of the fix",
  "codeChanges": ["Array of specific code changes needed"],
  "parameterAdjustments": {"param": "new_value"},
  "expectedImprovement": "What improvement is expected"
}`;

async function generateRepairSuggestion(
  diagnosis: ExperimentDiagnosis,
  model: LanguageModel,
): Promise<{
  repairDescription: string;
  codeChanges: string[];
  parameterAdjustments: Record<string, unknown>;
  expectedImprovement: string;
}> {
  const result = await generateText({
    model,
    system: REPAIR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Diagnosis: ${JSON.stringify(diagnosis, null, 2)}`,
      },
    ],
    maxOutputTokens: 2048,
  });

  const parsed = safeParseJson(result.text);
  return {
    repairDescription:
      (parsed.repairDescription as string) ?? "No repair description generated",
    codeChanges: (parsed.codeChanges as string[]) ?? [],
    parameterAdjustments:
      (parsed.parameterAdjustments as Record<string, unknown>) ?? {},
    expectedImprovement:
      (parsed.expectedImprovement as string) ?? "Unknown",
  };
}

// =============================================================
// Quality Assessment
// =============================================================

function assessExperimentQuality(
  artifacts: DeepResearchArtifact[],
): number {
  let score = 0;
  let checks = 0;

  // Check 1: Has step results
  const stepResults = artifacts.filter((a) => a.artifactType === "step_result");
  checks++;
  if (stepResults.length > 0) score += 0.3;

  // Check 2: Has experiment results
  const experimentResults = artifacts.filter(
    (a) => a.artifactType === "experiment_result",
  );
  checks++;
  if (experimentResults.length > 0) score += 0.3;

  // Check 3: Results contain metrics
  checks++;
  const allContent = [...stepResults, ...experimentResults]
    .map((a) => JSON.stringify(a.content ?? {}))
    .join("\n")
    .toLowerCase();

  const hasMetrics =
    /\b(accuracy|loss|f1|precision|recall|bleu|rouge|mae|mse|rmse|auc|perplexity)\b/.test(
      allContent,
    );
  if (hasMetrics) score += 0.2;

  // Check 4: No NaN/Inf
  checks++;
  if (!/\bnan\b/.test(allContent) && !/\binf(?:inity)?\b/.test(allContent)) {
    score += 0.1;
  }

  // Check 5: No error messages
  checks++;
  if (
    !/\berror\b/.test(allContent) &&
    !/\bexception\b/.test(allContent) &&
    !/\btraceback\b/.test(allContent)
  ) {
    score += 0.1;
  }

  return checks > 0 ? score / checks : 0;
}

// =============================================================
// Main Repair Loop
// =============================================================

/**
 * Run the experiment repair loop: diagnose → generate fix → re-run → assess.
 * Returns when quality is sufficient or max cycles exhausted.
 */
export async function runExperimentRepair(
  sessionId: string,
  node: DeepResearchNode,
  stepResults: DeepResearchArtifact[],
  experimentResults: DeepResearchArtifact[],
  config?: Partial<ExperimentRepairConfig>,
  modelOverride?: LanguageModel,
): Promise<ExperimentRepairResult> {
  const cfg = { ...DEFAULT_EXPERIMENT_REPAIR_CONFIG, ...config };

  if (!cfg.enabled) {
    return {
      success: true,
      totalCycles: 0,
      finalQuality: assessExperimentQuality([
        ...stepResults,
        ...experimentResults,
      ]),
      cycleHistory: [],
    };
  }

  const model =
    modelOverride ??
    getModelForRole("repair_specialist", {
      ...DEFAULT_EXPERIMENT_REPAIR_CONFIG,
      budget: { maxTotalTokens: 2_000_000, maxOpusTokens: 500_000 },
      maxWorkerFanOut: 1,
      maxReviewerRounds: 2,
      maxExecutionLoops: 3,
      maxWorkerConcurrency: 1,
      literature: {
        maxLiteratureRounds: 3,
        maxPapersPerRound: 10,
        maxTotalPapers: 30,
        maxReviewerRequestedExpansionRounds: 1,
        maxSearchRetries: 2,
      },
      execution: {
        defaultLauncherType: "rjob",
        defaultResources: { gpu: 2, memoryMb: 200000, cpu: 32, privateMachine: "yes" },
        defaultMounts: [],
        defaultChargedGroup: "",
      },
      pivotRefine: { maxRefineIterations: 3, maxPivotCount: 2, autoRefineConfidenceThreshold: 0.6, autoVersionArtifacts: true },
      debate: { maxDebateRounds: 3, enabledRoles: [], consensusMode: "majority" },
      evolution: { enabled: false, timeDecayDays: 30, maxLessonsPerSession: 5, enabledCategories: [], storePath: "evolution" },
      sentinel: { enabled: false, checkNumericSanity: true, checkEvidenceConsistency: true, checkCitationRelevance: true, autoPauseSeverityThreshold: 0.8 },
      claimVerification: { enabled: false, minSupportingSources: 1, autoFlagUnsupported: true, crossReferenceMode: "fuzzy" },
      experimentRepair: cfg,
      hardwareDetection: { enabled: false, adaptCodeGeneration: true, highVramThresholdMb: 8192 },
    }).model;

  const cycleHistory: RepairCycleResult[] = [];
  let allStepResults = [...stepResults];
  let allExperimentResults = [...experimentResults];

  for (let cycle = 1; cycle <= cfg.maxRepairCycles; cycle++) {
    // Step 1: Diagnose
    const diagnosis = cfg.autoDiagnose
      ? diagnoseFailure(allStepResults, allExperimentResults)
      : {
          deficiencyType: "other" as DeficiencyType,
          description: "Auto-diagnosis disabled",
          affectedFiles: [],
          errorMessages: [],
          rootCause: "Manual review required",
          fixable: false,
        };

    if (!diagnosis.fixable) {
      cycleHistory.push({
        cycle,
        diagnosis,
        repairApplied: false,
        repairDescription: "No fix available — diagnosis indicates unfixable issue",
        qualityAfterRepair: assessExperimentQuality([
          ...allStepResults,
          ...allExperimentResults,
        ]),
      });
      break;
    }

    // Step 2: Generate repair suggestion
    const repair = await generateRepairSuggestion(diagnosis, model);

    // Step 3: Record cycle
    const quality = assessExperimentQuality([
      ...allStepResults,
      ...allExperimentResults,
    ]);

    cycleHistory.push({
      cycle,
      diagnosis,
      repairApplied: true,
      repairDescription: repair.repairDescription,
      qualityAfterRepair: quality,
    });

    // Step 4: Check if quality is sufficient
    if (quality >= cfg.qualityThreshold) {
      return {
        success: true,
        totalCycles: cycle,
        finalQuality: quality,
        cycleHistory,
        finalDiagnosis: diagnosis,
      };
    }

    // Trigger re-run of experiment (handled by orchestrator)
    // The repair description and parameter changes will be used
    // by the orchestrator to update experiment parameters
  }

  const finalQuality = assessExperimentQuality([
    ...allStepResults,
    ...allExperimentResults,
  ]);

  return {
    success: finalQuality >= cfg.qualityThreshold,
    totalCycles: cycleHistory.length,
    finalQuality,
    cycleHistory,
  };
}

// Re-exported from repair-utils.ts (pure functions, no server deps)
export { buildRepairPromptOverlay } from "./repair-utils";
