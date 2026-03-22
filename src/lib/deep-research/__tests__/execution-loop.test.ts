// =============================================================
// Tests: Execution Loop — Full coverage for the new execution plane
// =============================================================
// Covers: remote executor, worker fanout, grouped execution,
// validation, experiment analysis, round management, lineage,
// SSH adapter, aggregation, stop conditions.

import { describe, it, expect, beforeEach } from "vitest";

import type {
  ExperimentSpec,
  ExperimentGroup,
  WorkerRun,
  WorkerFanoutPlan,
  ExecutionValidationResult,
  ExecutionRound,
  ValidationPlan,
} from "../types";

// --- Remote executor ---
import {
  RemoteExecutor,
  SSHSubmissionAdapter,
  setSSHRunner,
  resetSSHRunner,
  setSCPTransfer,
  resetSCPTransfer,
} from "../remote-executor";

// --- Worker aggregator ---
import {
  aggregateWorkerResults,
  computeAggregatedMetric,
  computeGroupStatus,
  summarizeAggregatedResult,
  createDefaultAggregationRules,
} from "../worker-aggregator";

// --- Execution validator ---
import {
  validateExperimentResults,
  validateSingleWorker,
  createDefaultValidationCriteria,
} from "../execution-validator";

// --- Experiment analysis ---
import {
  analyzeExperimentFailure,
  shouldStopExecution,
} from "../experiment-analysis";

// --- Execution round manager ---
import {
  createWorkerRuns,
  generateParameterCombinations,
  buildExperimentGroup,
  submitGroupWorkers,
  pollWorkerStatuses,
  collectWorkerResults,
  setResultsFetcher,
  resetResultsFetcher,
  createExecutionRound,
  validateAndAnalyzeRound,
  createExecutionLineage,
  addRoundToLineage,
  checkStopConditions,
  buildSimpleFanoutPlan,
  summarizeLineageForMainBrain,
} from "../execution-round-manager";

// --- Grouped pipeline ---
import {
  executeGroupedPipeline,
} from "../exec-pipeline";

// --- Mock adapter ---
import {
  MockSubmissionAdapter,
  resetMockState,
} from "../exec-job-submitter";

// --- Dataset/preprocess mocks ---
import {
  setFileExistenceChecker,
  resetFileExistenceChecker,
  setCommandExecutor,
  resetCommandExecutor,
} from "../exec-dataset-manager";

import {
  resetRunnerOverrides,
} from "../exec-preprocess-runner";

// -------------------------------------------------------------------
// Test fixtures
// -------------------------------------------------------------------

function makeSpec(overrides?: Partial<ExperimentSpec>): ExperimentSpec {
  return {
    experimentId: "exp-test-001",
    sessionId: "sess-001",
    name: "Test Experiment",
    description: "A test experiment",
    scale: "pilot",
    status: "planning",
    taskType: "training",
    models: ["llama-7b"],
    dataSources: [{
      id: "ds-0", name: "gsm8k", source: "huggingface",
      identifier: "gsm8k", estimatedSizeGb: 0.1,
      cachePath: "/tmp/test-cache/gsm8k",
    }],
    preprocessing: {
      enabled: false, steps: [], outputPath: "/tmp/preprocess",
      outputFormat: "jsonl", skipIfCached: true,
    },
    commands: [
      { name: "train", command: "python", args: ["train.py"], stage: "train", dependsOn: [] },
      { name: "eval", command: "python", args: ["eval.py"], stage: "eval", dependsOn: ["train"] },
    ],
    resources: {
      gpu: 2, cpu: 16, memoryMb: 128_000,
      walltime: "8:00:00", privateMachine: "yes",
    },
    mounts: [],
    environment: {
      modules: [], envVars: {}, setupCommands: [],
      workingDir: "/tmp/exp",
    },
    outputs: {
      baseDir: "/tmp/exp/out", checkpointDir: "/tmp/exp/out/ckpt",
      logDir: "/tmp/exp/out/logs", metricsDir: "/tmp/exp/out/metrics",
      artifactPatterns: ["*.json"],
    },
    retryPolicy: { maxRetries: 1, retryOnOOM: true, retryDelaySeconds: 60, scaleDownOnOOM: false },
    submissionMode: "mock",
    launcherType: "rjob",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeWorker(overrides?: Partial<WorkerRun>): WorkerRun {
  return {
    workerId: "w-001",
    parentExperimentId: "exp-test-001",
    groupId: "grp-001",
    label: "seed=42",
    spec: makeSpec(),
    jobId: "mock-job-1",
    status: "completed",
    paramOverrides: { seed: 42 },
    metrics: { accuracy: 0.85, loss: 0.05, f1: 0.83 },
    artifactPaths: ["/tmp/out/metrics.json"],
    logTail: "Training completed. Final accuracy: 0.85",
    exitCode: 0,
    runtimeSec: 3600,
    error: null,
    submittedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeGroup(workers: WorkerRun[], overrides?: Partial<ExperimentGroup>): ExperimentGroup {
  return {
    groupId: "grp-001",
    sessionId: "sess-001",
    roundNumber: 1,
    parentSpec: makeSpec(),
    decompositionStrategy: "seed_sweep",
    workers,
    dependencyGraph: {},
    aggregationRules: createDefaultAggregationRules(),
    validationCriteria: createDefaultValidationCriteria({ minSuccessfulWorkers: 1 }),
    status: "completed",
    aggregatedResult: null,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeFanoutPlan(overrides?: Partial<WorkerFanoutPlan>): WorkerFanoutPlan {
  return buildSimpleFanoutPlan(
    makeSpec(),
    "seed_sweep",
    [{ name: "seed", values: [42, 123, 456] }],
    overrides,
  );
}

// -------------------------------------------------------------------
// Worker Aggregator Tests
// -------------------------------------------------------------------

describe("worker-aggregator", () => {
  it("computes aggregated metric correctly", () => {
    const m = computeAggregatedMetric([0.8, 0.85, 0.9]);
    expect(m.mean).toBeCloseTo(0.85, 4);
    expect(m.min).toBe(0.8);
    expect(m.max).toBe(0.9);
    expect(m.median).toBe(0.85);
    expect(m.std).toBeGreaterThan(0);
    expect(m.values).toHaveLength(3);
  });

  it("handles single value", () => {
    const m = computeAggregatedMetric([0.5]);
    expect(m.mean).toBe(0.5);
    expect(m.std).toBe(0);
    expect(m.coefficientOfVariation).toBe(0);
  });

  it("handles empty values", () => {
    const m = computeAggregatedMetric([]);
    expect(m.mean).toBe(0);
  });

  it("aggregates worker results across a group", () => {
    const workers = [
      makeWorker({ workerId: "w1", metrics: { acc: 0.8, loss: 0.1 } }),
      makeWorker({ workerId: "w2", metrics: { acc: 0.85, loss: 0.08 } }),
      makeWorker({ workerId: "w3", metrics: { acc: 0.9, loss: 0.06 } }),
    ];
    const group = makeGroup(workers);
    const result = aggregateWorkerResults(group);

    expect(result.totalWorkers).toBe(3);
    expect(result.succeededWorkers).toBe(3);
    expect(result.failedWorkers).toBe(0);
    expect(result.metrics.acc.mean).toBeCloseTo(0.85, 4);
    expect(result.metrics.loss.mean).toBeCloseTo(0.08, 4);
    expect(result.workerSummaries).toHaveLength(3);
  });

  it("handles mixed success/failure workers", () => {
    const workers = [
      makeWorker({ workerId: "w1", status: "completed", metrics: { acc: 0.8 } }),
      makeWorker({ workerId: "w2", status: "failed", metrics: {} }),
    ];
    const group = makeGroup(workers);
    const result = aggregateWorkerResults(group);

    expect(result.succeededWorkers).toBe(1);
    expect(result.failedWorkers).toBe(1);
    expect(result.metrics.acc.mean).toBe(0.8);
  });

  it("computes group status correctly", () => {
    expect(computeGroupStatus(makeGroup([
      makeWorker({ status: "completed" }),
    ]))).toBe("completed");

    expect(computeGroupStatus(makeGroup([
      makeWorker({ status: "failed" }),
    ]))).toBe("failed");

    expect(computeGroupStatus(makeGroup([
      makeWorker({ status: "completed" }),
      makeWorker({ status: "failed" }),
    ]))).toBe("partially_failed");

    expect(computeGroupStatus(makeGroup([
      makeWorker({ status: "running" }),
    ]))).toBe("running");
  });

  it("generates human-readable summary", () => {
    const workers = [makeWorker({ metrics: { acc: 0.85 } })];
    const result = aggregateWorkerResults(makeGroup(workers));
    const summary = summarizeAggregatedResult(result);
    expect(summary).toContain("grp-001");
    expect(summary).toContain("acc");
  });
});

// -------------------------------------------------------------------
// Execution Validator Tests
// -------------------------------------------------------------------

describe("execution-validator", () => {
  it("returns pass when all criteria met", () => {
    const workers = [
      makeWorker({ metrics: { accuracy: 0.85 } }),
    ];
    const group = makeGroup(workers, {
      validationCriteria: createDefaultValidationCriteria({
        minSuccessfulWorkers: 1,
        metricThresholds: [{ metric: "accuracy", operator: "gte", value: 0.8 }],
      }),
    });
    const aggregated = aggregateWorkerResults(group);
    const result = validateExperimentResults(group, aggregated);

    expect(result.verdict).toBe("pass");
    expect(result.blockers).toHaveLength(0);
  });

  it("returns fail when metric threshold not met", () => {
    const workers = [
      makeWorker({ metrics: { accuracy: 0.5 } }),
    ];
    const group = makeGroup(workers, {
      validationCriteria: createDefaultValidationCriteria({
        minSuccessfulWorkers: 1,
        metricThresholds: [{ metric: "accuracy", operator: "gte", value: 0.8 }],
      }),
    });
    const aggregated = aggregateWorkerResults(group);
    const result = validateExperimentResults(group, aggregated);

    expect(result.verdict).toBe("fail");
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.metricComparisons[0].passed).toBe(false);
  });

  it("returns fail when required artifacts missing", () => {
    const workers = [
      makeWorker({ artifactPaths: [] }),
    ];
    const group = makeGroup(workers, {
      validationCriteria: createDefaultValidationCriteria({
        minSuccessfulWorkers: 1,
        requiredArtifacts: ["*.pt"],
      }),
    });
    const aggregated = aggregateWorkerResults(group);
    const result = validateExperimentResults(group, aggregated);

    expect(result.verdict).toBe("fail");
    expect(result.missingArtifacts).toContain("*.pt");
  });

  it("returns fail when too many workers failed", () => {
    const workers = [
      makeWorker({ workerId: "w1", status: "failed", metrics: {} }),
      makeWorker({ workerId: "w2", status: "failed", metrics: {} }),
    ];
    const group = makeGroup(workers, {
      validationCriteria: createDefaultValidationCriteria({
        minSuccessfulWorkers: 2,
      }),
    });
    const aggregated = aggregateWorkerResults(group);
    const result = validateExperimentResults(group, aggregated);

    expect(result.verdict).toBe("fail");
    expect(result.blockers.some(b => b.includes("workers succeeded"))).toBe(true);
  });

  it("checks baseline comparison", () => {
    const workers = [makeWorker({ metrics: { accuracy: 0.85 } })];
    const group = makeGroup(workers, {
      validationCriteria: createDefaultValidationCriteria({
        minSuccessfulWorkers: 1,
        baselineRequired: true,
        baselineMetrics: { accuracy: 0.9 },
      }),
    });
    const aggregated = aggregateWorkerResults(group);
    const result = validateExperimentResults(group, aggregated);

    expect(result.verdict).toBe("fail");
    expect(result.blockers.some(b => b.includes("baseline"))).toBe(true);
  });

  it("validates single worker", () => {
    expect(validateSingleWorker(makeWorker()).passed).toBe(true);
    expect(validateSingleWorker(makeWorker({ status: "failed" })).passed).toBe(false);
    expect(validateSingleWorker(makeWorker({ exitCode: 1 })).passed).toBe(false);
    expect(validateSingleWorker(makeWorker({ metrics: {} })).passed).toBe(false);
  });

  it("handles between operator", () => {
    const workers = [makeWorker({ metrics: { lr: 0.001 } })];
    const group = makeGroup(workers, {
      validationCriteria: createDefaultValidationCriteria({
        minSuccessfulWorkers: 1,
        metricThresholds: [{ metric: "lr", operator: "between", value: 0.0001, upperBound: 0.01 }],
      }),
    });
    const aggregated = aggregateWorkerResults(group);
    const result = validateExperimentResults(group, aggregated);
    expect(result.metricComparisons[0].passed).toBe(true);
  });
});

// -------------------------------------------------------------------
// Experiment Analysis Tests
// -------------------------------------------------------------------

describe("experiment-analysis", () => {
  it("detects OOM failures", () => {
    const workers = [
      makeWorker({
        status: "failed",
        exitCode: 137,
        logTail: "RuntimeError: CUDA out of memory",
        metrics: {},
      }),
    ];
    const group = makeGroup(workers, { status: "failed" });
    const aggregated = aggregateWorkerResults(group);
    const validation = validateExperimentResults(group, aggregated);
    const analysis = analyzeExperimentFailure(group, aggregated, validation);

    expect(analysis.rootCauses[0].category).toBe("oom");
    expect(analysis.rootCauses[0].confidence).toBeGreaterThan(0.9);
    expect(analysis.recommendations.some(r => r.action === "increase_resources")).toBe(true);
  });

  it("detects infrastructure failures", () => {
    const workers = [
      makeWorker({
        status: "failed",
        logTail: "NCCL error: connection refused",
        error: "distributed init failed",
        metrics: {},
      }),
    ];
    const group = makeGroup(workers, { status: "failed" });
    const aggregated = aggregateWorkerResults(group);
    const validation = validateExperimentResults(group, aggregated);
    const analysis = analyzeExperimentFailure(group, aggregated, validation);

    expect(analysis.rootCauses.some(c => c.category === "infrastructure_failure")).toBe(true);
    expect(analysis.shouldRerun).toBe(true);
  });

  it("detects negative scientific result", () => {
    const workers = [
      makeWorker({ metrics: { accuracy: 0.25 } }), // Far below threshold
    ];
    const group = makeGroup(workers, {
      validationCriteria: createDefaultValidationCriteria({
        minSuccessfulWorkers: 1,
        metricThresholds: [{ metric: "accuracy", operator: "gte", value: 0.8 }],
      }),
    });
    const aggregated = aggregateWorkerResults(group);
    const validation = validateExperimentResults(group, aggregated);
    const analysis = analyzeExperimentFailure(group, aggregated, validation);

    expect(analysis.rootCauses.some(c => c.category === "negative_scientific_result")).toBe(true);
    expect(analysis.shouldRedesign).toBe(true);
  });

  it("detects data issues", () => {
    const workers = [
      makeWorker({
        status: "failed",
        logTail: "FileNotFoundError: No such file or directory: '/data/train.jsonl'",
        metrics: {},
      }),
    ];
    const group = makeGroup(workers, { status: "failed" });
    const aggregated = aggregateWorkerResults(group);
    const validation = validateExperimentResults(group, aggregated);
    const analysis = analyzeExperimentFailure(group, aggregated, validation);

    expect(analysis.rootCauses.some(c => c.category === "data_issue")).toBe(true);
    expect(analysis.recommendations.some(r => r.action === "fix_data_pipeline")).toBe(true);
  });

  it("shouldStopExecution detects consecutive failures", () => {
    const rounds = [
      { validationResult: { verdict: "fail" } as unknown as ExecutionValidationResult, analysisResult: null },
      { validationResult: { verdict: "fail" } as unknown as ExecutionValidationResult, analysisResult: null },
      { validationResult: { verdict: "fail" } as unknown as ExecutionValidationResult, analysisResult: null },
    ];
    const result = shouldStopExecution(rounds);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toContain("consecutive");
  });

  it("shouldStopExecution allows continuation after success", () => {
    const rounds = [
      { validationResult: { verdict: "fail" } as unknown as ExecutionValidationResult, analysisResult: null },
      { validationResult: { verdict: "pass" } as unknown as ExecutionValidationResult, analysisResult: null },
      { validationResult: { verdict: "fail" } as unknown as ExecutionValidationResult, analysisResult: null },
    ];
    const result = shouldStopExecution(rounds);
    expect(result.shouldStop).toBe(false);
  });
});

// -------------------------------------------------------------------
// Execution Round Manager Tests
// -------------------------------------------------------------------

describe("execution-round-manager", () => {
  beforeEach(() => {
    resetMockState();
    resetResultsFetcher();
  });

  it("generates parameter combinations", () => {
    const combos = generateParameterCombinations([
      { name: "seed", values: [1, 2] },
      { name: "lr", values: [0.01, 0.001] },
    ]);
    expect(combos).toHaveLength(4);
    expect(combos[0]).toEqual({ seed: 1, lr: 0.01 });
    expect(combos[3]).toEqual({ seed: 2, lr: 0.001 });
  });

  it("creates worker runs from fanout plan", () => {
    const plan = makeFanoutPlan();
    const workers = createWorkerRuns(plan);
    expect(workers).toHaveLength(3);
    expect(workers[0].label).toContain("seed=42");
    expect(workers[1].label).toContain("seed=123");
    expect(workers[2].label).toContain("seed=456");
    expect(workers[0].status).toBe("pending");
  });

  it("creates single worker when no params", () => {
    const plan = buildSimpleFanoutPlan(makeSpec(), "custom", []);
    const workers = createWorkerRuns(plan);
    expect(workers).toHaveLength(1);
    expect(workers[0].label).toBe("single");
  });

  it("builds experiment group from fanout plan", () => {
    const plan = makeFanoutPlan();
    const group = buildExperimentGroup("sess-001", 1, plan);

    expect(group.sessionId).toBe("sess-001");
    expect(group.roundNumber).toBe(1);
    expect(group.workers).toHaveLength(3);
    expect(group.status).toBe("pending");
    expect(group.decompositionStrategy).toBe("seed_sweep");
  });

  it("submits group workers through mock adapter", async () => {
    const plan = makeFanoutPlan();
    const group = buildExperimentGroup("sess-001", 1, plan);
    const adapter = new MockSubmissionAdapter();

    const submitted = await submitGroupWorkers(group, adapter, "mock");
    const queued = submitted.workers.filter(w => w.status === "queued");
    expect(queued.length).toBe(3);
    expect(queued[0].jobId).toBeTruthy();
    expect(submitted.status).toBe("running");
  });

  it("polls worker statuses", async () => {
    const plan = makeFanoutPlan();
    let group = buildExperimentGroup("sess-001", 1, plan);
    const adapter = new MockSubmissionAdapter();

    group = await submitGroupWorkers(group, adapter, "mock");
    // First poll: queued → running
    group = await pollWorkerStatuses(group, adapter);
    expect(group.workers[0].status).toBe("running");

    // Second poll: running → completed
    group = await pollWorkerStatuses(group, adapter);
    expect(group.workers[0].status).toBe("completed");
  });

  it("collects worker results via fetcher", async () => {
    setResultsFetcher(async (_worker) => ({
      metrics: { accuracy: 0.85, loss: 0.05 },
      artifactPaths: ["/out/model.pt"],
      logTail: "Done",
    }));

    const workers = [makeWorker({ metrics: {}, artifactPaths: [], logTail: "" })];
    const group = makeGroup(workers);
    const collected = await collectWorkerResults(group);

    expect(collected.workers[0].metrics.accuracy).toBe(0.85);
    expect(collected.workers[0].artifactPaths).toContain("/out/model.pt");
  });

  it("creates and validates execution round", () => {
    const plan: ValidationPlan = {
      objective: "Test", hypothesis: "Test",
      literaturePrediction: "", requiredResources: { gpu: 2, memoryMb: 128000, cpu: 16, privateMachine: "yes" },
      datasets: [], steps: [], expectedOutputs: [],
      failureCriteria: [], successCriteria: [],
    };
    const round = createExecutionRound("sess-001", 1, plan);
    expect(round.roundNumber).toBe(1);
    expect(round.status).toBe("planning");
  });

  it("validates and analyzes a completed round", () => {
    const workers = [
      makeWorker({ workerId: "w1", metrics: { accuracy: 0.85 } }),
      makeWorker({ workerId: "w2", metrics: { accuracy: 0.87 } }),
    ];
    const group = makeGroup(workers, {
      validationCriteria: createDefaultValidationCriteria({
        minSuccessfulWorkers: 1,
        metricThresholds: [{ metric: "accuracy", operator: "gte", value: 0.8 }],
      }),
    });

    const round: ExecutionRound = {
      roundNumber: 1,
      sessionId: "sess-001",
      planSnapshot: {} as ValidationPlan,
      group,
      validationResult: null,
      analysisResult: null,
      changesFromPrevious: [],
      continueDecision: "pending",
      decisionReason: "",
      status: "executing",
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    const validated = validateAndAnalyzeRound(round);
    expect(validated.validationResult!.verdict).toBe("pass");
    expect(validated.analysisResult).toBeNull();
    expect(validated.status).toBe("completed");
  });

  it("routes failed round to analysis", () => {
    const workers = [
      makeWorker({ workerId: "w1", status: "failed", exitCode: 137, logTail: "OOM", metrics: {} }),
    ];
    const group = makeGroup(workers, {
      status: "failed",
      validationCriteria: createDefaultValidationCriteria({ minSuccessfulWorkers: 1 }),
    });

    const round: ExecutionRound = {
      roundNumber: 1, sessionId: "sess-001",
      planSnapshot: {} as ValidationPlan, group,
      validationResult: null, analysisResult: null,
      changesFromPrevious: [], continueDecision: "pending",
      decisionReason: "", status: "executing",
      startedAt: new Date().toISOString(), completedAt: null,
    };

    const validated = validateAndAnalyzeRound(round);
    expect(validated.validationResult!.verdict).not.toBe("pass");
    expect(validated.analysisResult).not.toBeNull();
    expect(validated.status).toBe("analyzing");
  });
});

// -------------------------------------------------------------------
// Execution Lineage Tests
// -------------------------------------------------------------------

describe("execution-lineage", () => {
  it("creates and tracks lineage across rounds", () => {
    let lineage = createExecutionLineage("sess-001", 5);
    expect(lineage.currentRound).toBe(0);
    expect(lineage.maxRounds).toBe(5);

    const round1: ExecutionRound = {
      roundNumber: 1, sessionId: "sess-001",
      planSnapshot: {} as ValidationPlan,
      group: null,
      validationResult: { verdict: "fail", confidenceScore: 0.3, criterionResults: [],
        missingArtifacts: [], metricComparisons: [],
        reasons: ["metrics below threshold"], blockers: ["accuracy too low"],
        retrySuggestion: null, replanSuggestion: null, severity: "major",
        validatedAt: new Date().toISOString() },
      analysisResult: null, changesFromPrevious: [],
      continueDecision: "replan", decisionReason: "", status: "completed",
      startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    };

    lineage = addRoundToLineage(lineage, round1);
    expect(lineage.currentRound).toBe(1);
    expect(lineage.consecutiveFailures).toBe(1);
    expect(lineage.hasPassingRound).toBe(false);

    const round2: ExecutionRound = {
      ...round1, roundNumber: 2,
      validationResult: { ...round1.validationResult!, verdict: "pass" },
    };
    lineage = addRoundToLineage(lineage, round2);
    expect(lineage.currentRound).toBe(2);
    expect(lineage.consecutiveFailures).toBe(0);
    expect(lineage.hasPassingRound).toBe(true);
  });

  it("detects max rounds stop condition", () => {
    const lineage = createExecutionLineage("sess-001", 2);
    lineage.currentRound = 2;
    const stop = checkStopConditions(lineage);
    expect(stop.shouldStop).toBe(true);
    expect(stop.reason).toContain("Maximum");
  });

  it("detects hypothesis falsification", () => {
    const lineage = createExecutionLineage("sess-001", 10);
    lineage.hypothesisFalsified = true;
    const stop = checkStopConditions(lineage);
    expect(stop.shouldStop).toBe(true);
    expect(stop.reason).toContain("falsified");
  });

  it("generates summary for Main Brain", () => {
    let lineage = createExecutionLineage("sess-001", 5);
    const round: ExecutionRound = {
      roundNumber: 1, sessionId: "sess-001",
      planSnapshot: {} as ValidationPlan, group: null,
      validationResult: { verdict: "pass", confidenceScore: 1,
        criterionResults: [], missingArtifacts: [], metricComparisons: [],
        reasons: ["All criteria met"], blockers: [], retrySuggestion: null,
        replanSuggestion: null, severity: "none", validatedAt: new Date().toISOString() },
      analysisResult: null, changesFromPrevious: [],
      continueDecision: "continue", decisionReason: "", status: "completed",
      startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    };
    lineage = addRoundToLineage(lineage, round);
    const summary = summarizeLineageForMainBrain(lineage);
    expect(summary).toContain("Round 1");
    expect(summary).toContain("pass");
  });
});

// -------------------------------------------------------------------
// Remote Executor Tests
// -------------------------------------------------------------------

describe("remote-executor", () => {
  beforeEach(() => {
    resetSSHRunner();
    resetSCPTransfer();
  });

  it("tests SSH connection with mock runner", async () => {
    setSSHRunner(async () => ({ stdout: "__ALIVE__", stderr: "", exitCode: 0 }));
    const executor = new RemoteExecutor({ host: "test-host", username: "user" });
    const result = await executor.testConnection();
    expect(result.connected).toBe(true);
  });

  it("fails connection test when host is missing", async () => {
    const executor = new RemoteExecutor({});
    const result = await executor.testConnection();
    expect(result.connected).toBe(false);
    expect(result.message).toContain("Missing");
  });

  it("detects available launchers", async () => {
    setSSHRunner(async (_config, cmd) => {
      if (cmd.includes("rjob")) return { stdout: "/usr/bin/rjob", stderr: "", exitCode: 0 };
      if (cmd.includes("rlaunch")) return { stdout: "/usr/bin/rlaunch", stderr: "", exitCode: 0 };
      return { stdout: "", stderr: "", exitCode: 1 };
    });
    const executor = new RemoteExecutor({ host: "h", username: "u" });
    const launchers = await executor.detectLaunchers();
    expect(launchers).toContain("rjob");
    expect(launchers).toContain("rlaunch");
    expect(launchers).not.toContain("slurm");
  });

  it("stages files remotely", async () => {
    const mkdirCalled: string[] = [];
    setSSHRunner(async (_config, cmd) => {
      mkdirCalled.push(cmd);
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    setSCPTransfer(async () => ({ success: true }));

    const executor = new RemoteExecutor({ host: "h", username: "u", remoteWorkDir: "/remote" });
    const result = await executor.stageFiles(["/local/file.py"], "exp-1");
    expect(result.success).toBe(true);
    expect(result.remotePaths).toHaveLength(1);
    expect(result.remotePaths[0]).toContain("/remote/exp-1/file.py");
  });

  it("submits job via SSH in dry_run mode", async () => {
    setSSHRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 }));
    const executor = new RemoteExecutor({ host: "h", username: "u" });
    const result = await executor.submitJob(makeSpec(), "dry_run");
    expect(result.success).toBe(true);
    expect(result.mode).toBe("dry_run");
    expect(result.renderedSpec).toContain("rjob");
  });

  it("submits job via SSH and parses job ID", async () => {
    setSSHRunner(async () => ({
      stdout: "Job submitted successfully. Job ID: 12345",
      stderr: "",
      exitCode: 0,
    }));
    const executor = new RemoteExecutor({ host: "h", username: "u" });
    const result = await executor.submitJob(makeSpec(), "real");
    expect(result.success).toBe(true);
    expect(result.jobId).toBe("12345");
  });

  it("handles SSH submission failure", async () => {
    setSSHRunner(async () => ({
      stdout: "",
      stderr: "Permission denied",
      exitCode: 1,
    }));
    const executor = new RemoteExecutor({ host: "h", username: "u" });
    const result = await executor.submitJob(makeSpec(), "real");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Permission denied");
  });

  it("queries remote job status", async () => {
    setSSHRunner(async () => ({ stdout: "Job 12345: running", stderr: "", exitCode: 0 }));
    const executor = new RemoteExecutor({ host: "h", username: "u" });
    const status = await executor.queryStatus("12345");
    expect(status.status).toBe("running");
  });

  it("fetches remote logs", async () => {
    setSSHRunner(async () => ({
      stdout: "Epoch 1/10: loss=0.5\nEpoch 10/10: loss=0.05",
      stderr: "",
      exitCode: 0,
    }));
    const executor = new RemoteExecutor({ host: "h", username: "u" });
    const logs = await executor.fetchLogs("12345");
    expect(logs.stdout).toContain("Epoch");
  });

  it("fetches remote outputs and parses metrics", async () => {
    setSSHRunner(async (_config, cmd) => {
      if (cmd.includes("find")) {
        return { stdout: "1024 /out/metrics.json\n2048 /out/model.pt", stderr: "", exitCode: 0 };
      }
      if (cmd.includes("cat")) {
        return { stdout: '{"accuracy": 0.85, "f1": 0.83}', stderr: "", exitCode: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const executor = new RemoteExecutor({ host: "h", username: "u" });
    const outputs = await executor.fetchOutputs("/out");
    expect(outputs.files).toHaveLength(2);
    expect(outputs.metrics.accuracy).toBe(0.85);
    expect(outputs.metrics.f1).toBe(0.83);
  });

  it("cancels remote job", async () => {
    setSSHRunner(async () => ({ stdout: "Cancelled", stderr: "", exitCode: 0 }));
    const executor = new RemoteExecutor({ host: "h", username: "u" });
    const result = await executor.cancelJob("12345");
    expect(result.success).toBe(true);
  });
});

// -------------------------------------------------------------------
// SSH Submission Adapter Tests
// -------------------------------------------------------------------

describe("SSHSubmissionAdapter", () => {
  beforeEach(() => {
    resetSSHRunner();
  });

  it("renders spec using inner launcher type", () => {
    setSSHRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 }));
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    const rendered = adapter.renderSpec(makeSpec());
    expect(rendered).toContain("rjob submit");
  });

  it("submits via SSH", async () => {
    setSSHRunner(async () => ({
      stdout: "Job ID: 99999",
      stderr: "",
      exitCode: 0,
    }));
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    const result = await adapter.submit(makeSpec(), "real");
    expect(result.success).toBe(true);
    expect(result.jobId).toBe("99999");
    expect(result.metadata).toHaveProperty("adapter", "ssh");
  });

  it("queries status via SSH", async () => {
    setSSHRunner(async () => ({ stdout: "completed", stderr: "", exitCode: 0 }));
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    const status = await adapter.queryStatus("12345");
    expect(status.status).toBe("completed");
  });

  it("fetches logs via SSH", async () => {
    setSSHRunner(async () => ({ stdout: "training log output", stderr: "", exitCode: 0 }));
    const adapter = new SSHSubmissionAdapter({ host: "h", username: "u" }, "rjob");
    const logs = await adapter.fetchLogs("12345");
    expect(logs.stdout).toContain("training");
  });
});

// -------------------------------------------------------------------
// Grouped Pipeline Integration Tests
// -------------------------------------------------------------------

describe("grouped-pipeline", () => {
  beforeEach(() => {
    resetMockState();
    resetFileExistenceChecker();
    resetCommandExecutor();
    resetRunnerOverrides();
    resetResultsFetcher();
  });

  it("runs full grouped pipeline with mock adapter", async () => {
    setFileExistenceChecker(() => false);
    setCommandExecutor(async () => ({ stdout: "OK", exitCode: 0 }));

    // Set up results fetcher to return mock metrics
    setResultsFetcher(async (_worker) => ({
      metrics: { accuracy: 0.85 + Math.random() * 0.05, loss: 0.05 },
      artifactPaths: ["/out/metrics.json"],
      logTail: "Training completed",
    }));

    const plan = buildSimpleFanoutPlan(
      makeSpec({ submissionMode: "mock" }),
      "seed_sweep",
      [{ name: "seed", values: [42, 123] }],
      {
        validationCriteria: createDefaultValidationCriteria({
          minSuccessfulWorkers: 1,
          metricThresholds: [{ metric: "accuracy", operator: "gte", value: 0.5 }],
        }),
      },
    );

    const result = await executeGroupedPipeline(plan);

    expect(result.group.workers).toHaveLength(2);
    expect(result.aggregated).not.toBeNull();
    expect(result.validationResult).not.toBeNull();
    expect(result.validationResult!.verdict).toBe("pass");
    expect(result.status).toBe("validated");
    expect(result.log.length).toBeGreaterThan(0);
  });

  it("handles pipeline readiness failure", async () => {
    const plan = buildSimpleFanoutPlan(
      makeSpec({ experimentId: "", commands: [] }),
      "custom",
      [],
    );
    const result = await executeGroupedPipeline(plan);
    expect(result.status).toBe("failed");
    expect(result.log.some(l => l.level === "error")).toBe(true);
  });

  it("handles failed workers with analysis", async () => {
    setFileExistenceChecker(() => false);
    setCommandExecutor(async () => ({ stdout: "OK", exitCode: 0 }));

    // Make the results fetcher simulate failed metrics
    setResultsFetcher(async () => ({
      metrics: { accuracy: 0.2 },
      artifactPaths: [],
      logTail: "OOM error",
    }));

    const plan = buildSimpleFanoutPlan(
      makeSpec({ submissionMode: "mock" }),
      "seed_sweep",
      [{ name: "seed", values: [42] }],
      {
        validationCriteria: createDefaultValidationCriteria({
          minSuccessfulWorkers: 1,
          metricThresholds: [{ metric: "accuracy", operator: "gte", value: 0.8 }],
        }),
      },
    );

    const result = await executeGroupedPipeline(plan);

    expect(result.validationResult!.verdict).not.toBe("pass");
    expect(result.analysisResult).not.toBeNull();
    expect(result.log.some(l => l.stage === "analyze")).toBe(true);
  });

  it("supports sequential worker dependencies", async () => {
    setFileExistenceChecker(() => false);
    setCommandExecutor(async () => ({ stdout: "OK", exitCode: 0 }));
    setResultsFetcher(async () => ({
      metrics: { accuracy: 0.85 },
      artifactPaths: [],
      logTail: "Done",
    }));

    const plan = buildSimpleFanoutPlan(
      makeSpec({ submissionMode: "mock" }),
      "train_eval_split",
      [{ name: "phase", values: ["train", "eval"] }],
      {
        dependencyType: "sequential",
        validationCriteria: createDefaultValidationCriteria({ minSuccessfulWorkers: 1 }),
      },
    );

    const result = await executeGroupedPipeline(plan);
    expect(result.group.workers).toHaveLength(2);
    // Sequential deps should still complete
    expect(result.status).not.toBe("failed");
  });
});

// -------------------------------------------------------------------
// Skill Library Tests (new execution skills)
// -------------------------------------------------------------------

describe("skill-library-execution", () => {
  it("has execution loop skills registered", async () => {
    const { defaultSkillRegistry } = await import("../skill-library");
    const executionSkills = defaultSkillRegistry.getByCategory("execution");
    expect(executionSkills.length).toBeGreaterThanOrEqual(10); // Original 5 + new 5+
    expect(executionSkills.some(s => s.id === "worker_fanout_design")).toBe(true);
    expect(executionSkills.some(s => s.id === "result_validation")).toBe(true);
    expect(executionSkills.some(s => s.id === "experiment_failure_analysis")).toBe(true);
    expect(executionSkills.some(s => s.id === "replanning_after_execution")).toBe(true);
    expect(executionSkills.some(s => s.id === "gpu_resource_planning")).toBe(true);
  });

  it("describes skills for LLM including new execution skills", async () => {
    const { defaultSkillRegistry } = await import("../skill-library");
    const desc = defaultSkillRegistry.describeForLLM();
    expect(desc).toContain("worker_fanout_design");
    expect(desc).toContain("experiment_failure_analysis");
  });
});
