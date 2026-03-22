// =============================================================
// Execution Round Manager — Iterative plan→execute→validate→replan
// =============================================================
// Manages the full lifecycle of execution rounds:
//   1. Convert approved plan → worker specs
//   2. Submit workers (parallel or staged)
//   3. Monitor completion
//   4. Aggregate results
//   5. Validate against criteria
//   6. Route failures to experiment analysis
//   7. Support Main Brain replanning
//   8. Track lineage across rounds

import type {
  ExperimentSpec,
  ExperimentGroup,
  WorkerRun,
  WorkerFanoutPlan,
  ExecutionRound,
  ExecutionLineage,
  ExperimentAnalysisResult,
  ValidationPlan,
  JobStatus,
  SubmissionMode,
  WorkerDecompositionStrategy,
  WorkerRunStatus,
} from "./types";
import type { SubmissionAdapter } from "./exec-job-submitter";
import { aggregateWorkerResults, computeGroupStatus, createDefaultAggregationRules } from "./worker-aggregator";
import { validateExperimentResults, createDefaultValidationCriteria } from "./execution-validator";
import { analyzeExperimentFailure, shouldStopExecution } from "./experiment-analysis";
import { nanoid } from "nanoid";

// -------------------------------------------------------------------
// Worker Fanout — Decompose experiment into workers
// -------------------------------------------------------------------

/**
 * Create worker runs from a fanout plan.
 */
export function createWorkerRuns(plan: WorkerFanoutPlan): WorkerRun[] {
  const workers: WorkerRun[] = [];
  const groupId = `grp-${nanoid(8)}`;

  if (plan.parameterSpace.length === 0) {
    // Single worker (no decomposition)
    workers.push(createSingleWorker(plan.parentSpec, groupId, plan.parentSpec.experimentId, {}));
    return workers;
  }

  // Generate parameter combinations
  const combinations = generateParameterCombinations(plan.parameterSpace);
  const effectiveCount = Math.min(combinations.length, plan.totalWorkers);

  for (let i = 0; i < effectiveCount; i++) {
    const params = combinations[i];
    const label = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(",");
    const workerId = `w-${nanoid(6)}`;

    // Create worker-specific spec by cloning parent and applying overrides
    const workerSpec: ExperimentSpec = {
      ...plan.parentSpec,
      experimentId: `${plan.parentSpec.experimentId}-${workerId}`,
      name: `${plan.parentSpec.name} [${label}]`,
      commands: applyParamOverrides(plan.parentSpec.commands, params),
      resources: { ...plan.perWorkerResources },
    };

    workers.push({
      workerId,
      parentExperimentId: plan.parentSpec.experimentId,
      groupId,
      label,
      spec: workerSpec,
      jobId: null,
      status: "pending",
      paramOverrides: params,
      metrics: {},
      artifactPaths: [],
      logTail: "",
      exitCode: null,
      runtimeSec: null,
      error: null,
      submittedAt: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  return workers;
}

function createSingleWorker(
  spec: ExperimentSpec,
  groupId: string,
  parentId: string,
  params: Record<string, unknown>,
): WorkerRun {
  return {
    workerId: `w-${nanoid(6)}`,
    parentExperimentId: parentId,
    groupId,
    label: "single",
    spec,
    jobId: null,
    status: "pending",
    paramOverrides: params,
    metrics: {},
    artifactPaths: [],
    logTail: "",
    exitCode: null,
    runtimeSec: null,
    error: null,
    submittedAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate all combinations from a parameter space.
 */
export function generateParameterCombinations(
  parameterSpace: Array<{ name: string; values: unknown[] }>,
): Array<Record<string, unknown>> {
  if (parameterSpace.length === 0) return [{}];

  const result: Array<Record<string, unknown>> = [];

  function recurse(idx: number, current: Record<string, unknown>) {
    if (idx >= parameterSpace.length) {
      result.push({ ...current });
      return;
    }
    const param = parameterSpace[idx];
    for (const value of param.values) {
      current[param.name] = value;
      recurse(idx + 1, current);
    }
  }

  recurse(0, {});
  return result;
}

function applyParamOverrides(
  commands: ExperimentSpec["commands"],
  params: Record<string, unknown>,
): ExperimentSpec["commands"] {
  return commands.map(cmd => ({
    ...cmd,
    args: [
      ...cmd.args,
      ...Object.entries(params).map(([k, v]) => `--${k}=${v}`),
    ],
  }));
}

// -------------------------------------------------------------------
// Experiment Group Builder
// -------------------------------------------------------------------

/**
 * Build an ExperimentGroup from a fanout plan.
 */
export function buildExperimentGroup(
  sessionId: string,
  roundNumber: number,
  plan: WorkerFanoutPlan,
): ExperimentGroup {
  const workers = createWorkerRuns(plan);
  const groupId = workers[0]?.groupId ?? `grp-${nanoid(8)}`;

  // Build dependency graph
  const dependencyGraph: Record<string, string[]> = {};
  if (plan.dependencyType === "sequential") {
    for (let i = 1; i < workers.length; i++) {
      dependencyGraph[workers[i].workerId] = [workers[i - 1].workerId];
    }
  }
  // independent and staged_dag leave deps empty (or custom-set later)

  // Update all workers with the correct groupId
  for (const w of workers) {
    (w as { groupId: string }).groupId = groupId;
  }

  return {
    groupId,
    sessionId,
    roundNumber,
    parentSpec: plan.parentSpec,
    decompositionStrategy: plan.strategy,
    workers,
    dependencyGraph,
    aggregationRules: plan.aggregationRules,
    validationCriteria: plan.validationCriteria,
    status: "pending",
    aggregatedResult: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

// -------------------------------------------------------------------
// Worker Submission — Submit all workers through an adapter
// -------------------------------------------------------------------

/**
 * Submit all ready workers in a group.
 * Respects dependency graph: only submit workers whose deps are completed.
 */
export async function submitGroupWorkers(
  group: ExperimentGroup,
  adapter: SubmissionAdapter,
  mode: SubmissionMode,
  maxParallel: number = Infinity,
): Promise<ExperimentGroup> {
  const updated = { ...group, workers: [...group.workers] };
  let submitted = 0;

  for (let i = 0; i < updated.workers.length; i++) {
    const worker = updated.workers[i];
    if (worker.status !== "pending") continue;
    if (submitted >= maxParallel) break;

    // Check dependencies
    const deps = updated.dependencyGraph[worker.workerId] ?? [];
    const depsReady = deps.every(depId => {
      const dep = updated.workers.find(w => w.workerId === depId);
      return dep && dep.status === "completed";
    });

    if (!depsReady && deps.length > 0) continue;

    // Submit
    const result = await adapter.submit(worker.spec, mode);
    updated.workers[i] = {
      ...worker,
      jobId: result.jobId,
      status: result.success ? "queued" as WorkerRunStatus : "failed" as WorkerRunStatus,
      error: result.success ? null : result.message,
      submittedAt: new Date().toISOString(),
    };
    submitted++;
  }

  updated.status = "running";
  return updated;
}

// -------------------------------------------------------------------
// Worker Monitoring — Check status of all submitted workers
// -------------------------------------------------------------------

/**
 * Poll status of all active workers.
 */
export async function pollWorkerStatuses(
  group: ExperimentGroup,
  adapter: SubmissionAdapter,
): Promise<ExperimentGroup> {
  const updated = { ...group, workers: [...group.workers] };

  for (let i = 0; i < updated.workers.length; i++) {
    const worker = updated.workers[i];
    if (!worker.jobId) continue;
    if (worker.status === "completed" || worker.status === "failed" || worker.status === "cancelled") continue;

    const status = await adapter.queryStatus(worker.jobId);

    const newStatus = mapJobStatusToWorkerStatus(status.status);
    updated.workers[i] = {
      ...worker,
      status: newStatus,
      exitCode: status.exitCode ?? worker.exitCode,
      runtimeSec: status.runningTimeSec ?? worker.runtimeSec,
      completedAt: (newStatus === "completed" || newStatus === "failed")
        ? new Date().toISOString()
        : worker.completedAt,
    };
  }

  updated.status = computeGroupStatus(updated);
  return updated;
}

function mapJobStatusToWorkerStatus(jobStatus: JobStatus): WorkerRunStatus {
  switch (jobStatus) {
    case "pending": return "pending";
    case "queued": return "queued";
    case "running": return "running";
    case "completed": return "completed";
    case "failed": return "failed";
    case "cancelled": return "cancelled";
    default: return "running";
  }
}

// -------------------------------------------------------------------
// Result Collection — Fetch logs/metrics for completed workers
// -------------------------------------------------------------------

/**
 * Collect results (metrics, logs, artifacts) for completed workers.
 * Uses a results fetcher function that can be mocked for testing.
 */
export type ResultsFetcher = (worker: WorkerRun) => Promise<{
  metrics: Record<string, number>;
  artifactPaths: string[];
  logTail: string;
}>;

/** Default no-op fetcher (returns what's already on the worker). */
const defaultFetcher: ResultsFetcher = async (worker) => ({
  metrics: worker.metrics,
  artifactPaths: worker.artifactPaths,
  logTail: worker.logTail,
});

let _resultsFetcher: ResultsFetcher = defaultFetcher;

export function setResultsFetcher(fetcher: ResultsFetcher): void {
  _resultsFetcher = fetcher;
}

export function resetResultsFetcher(): void {
  _resultsFetcher = defaultFetcher;
}

export async function collectWorkerResults(group: ExperimentGroup): Promise<ExperimentGroup> {
  const updated = { ...group, workers: [...group.workers] };

  for (let i = 0; i < updated.workers.length; i++) {
    const worker = updated.workers[i];
    if (worker.status !== "completed" && worker.status !== "failed") continue;
    if (Object.keys(worker.metrics).length > 0) continue; // Already collected

    try {
      const results = await _resultsFetcher(worker);
      updated.workers[i] = {
        ...worker,
        metrics: results.metrics,
        artifactPaths: results.artifactPaths,
        logTail: results.logTail,
      };
    } catch {
      // If collection fails, keep what we have
    }
  }

  return updated;
}

// -------------------------------------------------------------------
// Execution Round — Full round lifecycle
// -------------------------------------------------------------------

/**
 * Create a new execution round.
 */
export function createExecutionRound(
  sessionId: string,
  roundNumber: number,
  plan: ValidationPlan,
): ExecutionRound {
  return {
    roundNumber,
    sessionId,
    planSnapshot: plan,
    group: null,
    validationResult: null,
    analysisResult: null,
    changesFromPrevious: [],
    continueDecision: "pending",
    decisionReason: "",
    status: "planning",
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

/**
 * Run the full validation + analysis cycle for a completed group.
 * Returns the updated round with validation and (if needed) analysis results.
 */
export function validateAndAnalyzeRound(round: ExecutionRound): ExecutionRound {
  if (!round.group || round.group.status === "pending" || round.group.status === "running") {
    return round;
  }

  // Aggregate results
  const aggregated = aggregateWorkerResults(round.group);
  const groupWithResult = { ...round.group, aggregatedResult: aggregated };

  // Validate
  const validationResult = validateExperimentResults(groupWithResult, aggregated);

  // Analyze if failed/inconclusive
  let analysisResult: ExperimentAnalysisResult | null = null;
  if (validationResult.verdict !== "pass") {
    analysisResult = analyzeExperimentFailure(groupWithResult, aggregated, validationResult);
  }

  return {
    ...round,
    group: groupWithResult,
    validationResult,
    analysisResult,
    status: validationResult.verdict === "pass" ? "completed" : "analyzing",
  };
}

// -------------------------------------------------------------------
// Execution Lineage — Track across all rounds
// -------------------------------------------------------------------

/**
 * Create a new execution lineage tracker.
 */
export function createExecutionLineage(sessionId: string, maxRounds: number): ExecutionLineage {
  return {
    sessionId,
    rounds: [],
    currentRound: 0,
    maxRounds,
    hypothesisFalsified: false,
    consecutiveFailures: 0,
    hasPassingRound: false,
    cumulativeEvidence: [],
  };
}

/**
 * Add a completed round to the lineage and update counters.
 */
export function addRoundToLineage(lineage: ExecutionLineage, round: ExecutionRound): ExecutionLineage {
  const updated = { ...lineage, rounds: [...lineage.rounds, round] };
  updated.currentRound = updated.rounds.length;

  // Update counters
  if (round.validationResult?.verdict === "pass") {
    updated.hasPassingRound = true;
    updated.consecutiveFailures = 0;
  } else {
    updated.consecutiveFailures++;
  }

  // Check for hypothesis falsification
  if (round.analysisResult?.rootCauses.some(
    c => c.category === "negative_scientific_result" && c.confidence > 0.7
  )) {
    const priorNegative = lineage.rounds.some(r =>
      r.analysisResult?.rootCauses.some(c => c.category === "negative_scientific_result" && c.confidence > 0.7)
    );
    if (priorNegative) {
      updated.hypothesisFalsified = true;
    }
  }

  // Build cumulative evidence
  if (round.validationResult) {
    updated.cumulativeEvidence.push(
      `Round ${round.roundNumber}: ${round.validationResult.verdict} — ${round.validationResult.reasons.join("; ")}`
    );
  }

  return updated;
}

/**
 * Check whether the execution loop should stop.
 */
export function checkStopConditions(lineage: ExecutionLineage): {
  shouldStop: boolean;
  reason: string;
} {
  // Max rounds reached
  if (lineage.currentRound >= lineage.maxRounds) {
    return { shouldStop: true, reason: `Maximum execution rounds (${lineage.maxRounds}) reached` };
  }

  // Hypothesis falsified
  if (lineage.hypothesisFalsified) {
    return { shouldStop: true, reason: "Hypothesis has been falsified by repeated negative scientific results" };
  }

  // Check repeated failure pattern
  const stopCheck = shouldStopExecution(
    lineage.rounds.map(r => ({
      validationResult: r.validationResult,
      analysisResult: r.analysisResult,
    }))
  );
  if (stopCheck.shouldStop) {
    return stopCheck;
  }

  return { shouldStop: false, reason: "" };
}

// -------------------------------------------------------------------
// Convenience: Build a simple fanout plan from validation plan
// -------------------------------------------------------------------

export function buildSimpleFanoutPlan(
  parentSpec: ExperimentSpec,
  strategy: WorkerDecompositionStrategy,
  paramSpace: Array<{ name: string; values: unknown[] }>,
  overrides?: Partial<WorkerFanoutPlan>,
): WorkerFanoutPlan {
  const totalWorkers = paramSpace.reduce((acc, p) => acc * p.values.length, 1) || 1;

  return {
    parentSpec,
    strategy,
    parameterSpace: paramSpace,
    totalWorkers,
    maxParallel: overrides?.maxParallel ?? totalWorkers,
    pilotFirst: overrides?.pilotFirst ?? false,
    dependencyType: overrides?.dependencyType ?? "independent",
    validationCriteria: overrides?.validationCriteria ?? createDefaultValidationCriteria({
      minSuccessfulWorkers: Math.max(1, Math.ceil(totalWorkers * 0.5)),
    }),
    aggregationRules: overrides?.aggregationRules ?? createDefaultAggregationRules(),
    estimatedTotalGPUHours: overrides?.estimatedTotalGPUHours ??
      totalWorkers * parentSpec.resources.gpu * 4,
    perWorkerResources: overrides?.perWorkerResources ?? parentSpec.resources,
  };
}

// -------------------------------------------------------------------
// Summary for Main Brain
// -------------------------------------------------------------------

export function summarizeLineageForMainBrain(lineage: ExecutionLineage): string {
  const lines: string[] = [];

  lines.push(`## Execution Lineage — ${lineage.rounds.length}/${lineage.maxRounds} rounds`);
  lines.push(`Has passing round: ${lineage.hasPassingRound}`);
  lines.push(`Consecutive failures: ${lineage.consecutiveFailures}`);
  lines.push(`Hypothesis falsified: ${lineage.hypothesisFalsified}`);
  lines.push("");

  for (const round of lineage.rounds) {
    const verdict = round.validationResult?.verdict ?? "pending";
    const workersInfo = round.group
      ? `${round.group.workers.filter(w => w.status === "completed").length}/${round.group.workers.length} workers`
      : "no workers";
    lines.push(`### Round ${round.roundNumber}: ${verdict} (${workersInfo})`);
    if (round.validationResult?.reasons.length) {
      lines.push(`  Reasons: ${round.validationResult.reasons.slice(0, 3).join("; ")}`);
    }
    if (round.analysisResult) {
      lines.push(`  Analysis: ${round.analysisResult.primaryRecommendation}`);
    }
    if (round.changesFromPrevious.length > 0) {
      lines.push(`  Changes: ${round.changesFromPrevious.join("; ")}`);
    }
  }

  return lines.join("\n");
}
