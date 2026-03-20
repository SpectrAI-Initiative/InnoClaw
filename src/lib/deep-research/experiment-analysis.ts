// =============================================================
// Experiment Analysis — Diagnose failed/weak experiment outcomes
// =============================================================
// Reads job logs, metrics, validation reports, and worker variance
// to produce structured root-cause analysis and recommendations.

import type {
  ExperimentGroup,
  WorkerRun,
  AggregatedResult,
  ExecutionValidationResult,
  ExperimentAnalysisResult,
  ExperimentFailureCategory,
  ExperimentAnalysisRecommendation,
} from "./types";

// -------------------------------------------------------------------
// Main analysis function
// -------------------------------------------------------------------

/**
 * Analyze a failed or inconclusive experiment group.
 * Returns structured diagnosis with root causes and recommendations.
 */
export function analyzeExperimentFailure(
  group: ExperimentGroup,
  aggregated: AggregatedResult | null,
  validationResult: ExecutionValidationResult,
): ExperimentAnalysisResult {
  const rootCauses: ExperimentAnalysisResult["rootCauses"] = [];
  const recommendations: ExperimentAnalysisResult["recommendations"] = [];
  const suggestedFixes: ExperimentAnalysisResult["suggestedFixes"] = [];

  // Analyze each worker for failure patterns
  const failedWorkers = group.workers.filter(w => w.status === "failed" || w.status === "timeout");
  const succeededWorkers = group.workers.filter(w => w.status === "completed");

  // --- Pattern 1: OOM detection ---
  const oomWorkers = failedWorkers.filter(w => isOOM(w));
  if (oomWorkers.length > 0) {
    rootCauses.push({
      category: "oom",
      description: `${oomWorkers.length}/${group.workers.length} workers failed with OOM`,
      confidence: 0.95,
      supportingEvidence: oomWorkers.map(w => `Worker ${w.label}: ${extractOOMInfo(w)}`),
    });
    recommendations.push({
      action: "increase_resources",
      reasoning: "Workers ran out of memory. Increase GPU memory or reduce batch size.",
      estimatedEffort: "low",
      requiredChanges: [
        "Increase memoryMb in resource spec",
        "Or add --per_device_train_batch_size=<smaller> to training args",
        "Or use gradient accumulation steps",
      ],
    });
    suggestedFixes.push({
      target: "resources.memoryMb",
      fix: `Increase from ${group.parentSpec.resources.memoryMb} to ${Math.ceil(group.parentSpec.resources.memoryMb * 1.5)}`,
      priority: "critical",
    });
  }

  // --- Pattern 2: Timeout detection ---
  const timeoutWorkers = failedWorkers.filter(w => w.status === "timeout" || isTimeout(w));
  if (timeoutWorkers.length > 0 && oomWorkers.length === 0) {
    rootCauses.push({
      category: "timeout",
      description: `${timeoutWorkers.length} workers timed out`,
      confidence: 0.9,
      supportingEvidence: timeoutWorkers.map(w => `Worker ${w.label}: runtime=${w.runtimeSec}s`),
    });
    recommendations.push({
      action: "increase_resources",
      reasoning: "Workers exceeded walltime. Increase walltime or use fewer training steps.",
      estimatedEffort: "low",
      requiredChanges: ["Increase walltime in resource spec", "Or reduce max_steps/epochs"],
    });
  }

  // --- Pattern 3: Infrastructure/launcher failure ---
  const infraFailures = failedWorkers.filter(w => isInfraFailure(w));
  if (infraFailures.length > 0) {
    rootCauses.push({
      category: "infrastructure_failure",
      description: `${infraFailures.length} workers failed due to infrastructure issues`,
      confidence: 0.8,
      supportingEvidence: infraFailures.map(w => `Worker ${w.label}: ${w.error?.slice(0, 200)}`),
    });
    recommendations.push({
      action: "rerun_unchanged",
      reasoning: "Infrastructure failure is typically transient. Rerunning may succeed.",
      estimatedEffort: "low",
      requiredChanges: [],
    });
  }

  // --- Pattern 4: Data issues ---
  const dataFailures = failedWorkers.filter(w => isDataIssue(w));
  if (dataFailures.length > 0) {
    rootCauses.push({
      category: "data_issue",
      description: "Workers failed due to data loading or format issues",
      confidence: 0.85,
      supportingEvidence: dataFailures.map(w => `Worker ${w.label}: ${extractDataError(w)}`),
    });
    recommendations.push({
      action: "fix_data_pipeline",
      reasoning: "Data pipeline errors need fixing before rerun.",
      estimatedEffort: "medium",
      requiredChanges: ["Check data format", "Verify dataset paths", "Review preprocessing"],
    });
  }

  // --- Pattern 5: All workers succeeded but metrics are bad ---
  if (failedWorkers.length === 0 && validationResult.verdict !== "pass") {
    const metricFails = validationResult.metricComparisons.filter(m => !m.passed);
    if (metricFails.length > 0) {
      // Check if it's close to threshold (inconclusive) or far below (negative result)
      const closeMisses = metricFails.filter(m => {
        const ratio = m.actual / m.threshold;
        return ratio > 0.8 && ratio < 1.0;
      });

      if (closeMisses.length > 0) {
        rootCauses.push({
          category: "unstable_training",
          description: "Metrics are close to but below thresholds — may need more training or tuning",
          confidence: 0.7,
          supportingEvidence: closeMisses.map(m => `${m.metric}: ${m.actual.toFixed(4)} vs threshold ${m.threshold}`),
        });
        recommendations.push({
          action: "rerun_with_fixes",
          reasoning: "Results are close to passing. Try with more training steps, better hyperparameters, or more data.",
          estimatedEffort: "medium",
          requiredChanges: ["Increase training steps", "Tune learning rate", "Check data quality"],
        });
      } else {
        rootCauses.push({
          category: "negative_scientific_result",
          description: "Metrics are significantly below thresholds — hypothesis may be incorrect",
          confidence: 0.6,
          supportingEvidence: metricFails.map(m => `${m.metric}: ${m.actual.toFixed(4)} far below threshold ${m.threshold}`),
        });
        recommendations.push({
          action: "redesign_experiment",
          reasoning: "Results are far below expectations. The hypothesis may need revision.",
          estimatedEffort: "high",
          requiredChanges: ["Revise hypothesis", "Consider alternative approaches", "Check if baseline is correct"],
        });
      }
    }

    // Check missing artifacts
    if (validationResult.missingArtifacts.length > 0) {
      rootCauses.push({
        category: "implementation_bug",
        description: `Expected outputs not produced: ${validationResult.missingArtifacts.join(", ")}`,
        confidence: 0.75,
        supportingEvidence: [`Missing: ${validationResult.missingArtifacts.join(", ")}`],
      });
      suggestedFixes.push({
        target: "output_config",
        fix: "Verify that scripts produce the expected output files at the expected paths",
        priority: "high",
      });
    }
  }

  // --- Pattern 6: High variance across seeds ---
  if (aggregated) {
    const highVarianceMetrics = Object.entries(aggregated.metrics).filter(
      ([_, m]) => m.coefficientOfVariation > 0.3 && m.values.length >= 2
    );
    if (highVarianceMetrics.length > 0) {
      rootCauses.push({
        category: "unstable_training",
        description: `High variance across workers in: ${highVarianceMetrics.map(([k]) => k).join(", ")}`,
        confidence: 0.65,
        supportingEvidence: highVarianceMetrics.map(
          ([k, m]) => `${k}: CV=${m.coefficientOfVariation.toFixed(3)}, range=[${m.min.toFixed(4)}, ${m.max.toFixed(4)}]`
        ),
      });
      recommendations.push({
        action: "rerun_with_fixes",
        reasoning: "Results are unstable across seeds. Consider more seeds, longer training, or learning rate warmup.",
        estimatedEffort: "medium",
        requiredChanges: ["Add more seed runs", "Increase training duration", "Use learning rate warmup"],
      });
    }
  }

  // --- Pattern 7: Metric mismatch (metrics present but wrong names) ---
  if (aggregated && validationResult.metricComparisons.some(m => isNaN(m.actual))) {
    const missing = validationResult.metricComparisons.filter(m => isNaN(m.actual)).map(m => m.metric);
    const available = Object.keys(aggregated.metrics);
    rootCauses.push({
      category: "metric_mismatch",
      description: `Expected metrics not found. Expected: [${missing.join(", ")}]. Available: [${available.join(", ")}]`,
      confidence: 0.85,
      supportingEvidence: [`Mismatched metric names between validation criteria and actual outputs`],
    });
    suggestedFixes.push({
      target: "validation_criteria",
      fix: `Update metric names. Available metrics: ${available.join(", ")}`,
      priority: "high",
    });
  }

  // If no specific cause found, classify as unknown
  if (rootCauses.length === 0) {
    rootCauses.push({
      category: "unknown",
      description: "No specific failure pattern detected. Manual investigation needed.",
      confidence: 0.3,
      supportingEvidence: failedWorkers.map(w => `Worker ${w.label}: status=${w.status}, error=${w.error?.slice(0, 100) ?? "none"}`),
    });
    recommendations.push({
      action: "rerun_unchanged",
      reasoning: "No clear failure pattern. A rerun may help determine if the issue is transient.",
      estimatedEffort: "low",
      requiredChanges: [],
    });
  }

  // Sort by confidence
  rootCauses.sort((a, b) => b.confidence - a.confidence);

  // Determine primary recommendation
  const primaryRecommendation = recommendations[0]?.action ?? "rerun_unchanged";
  const shouldRerun = primaryRecommendation === "rerun_unchanged" || primaryRecommendation === "rerun_with_fixes";
  const shouldRedesign = primaryRecommendation === "redesign_experiment" || primaryRecommendation === "pivot_hypothesis";
  const shouldStop = primaryRecommendation === "stop_research";

  // Build summary
  const summaryParts = [
    `Experiment group ${group.groupId} round ${group.roundNumber}: ${validationResult.verdict}`,
    `Workers: ${succeededWorkers.length} succeeded, ${failedWorkers.length} failed out of ${group.workers.length}`,
    `Top root cause: ${rootCauses[0]?.category} (confidence: ${(rootCauses[0]?.confidence * 100).toFixed(0)}%)`,
    `Recommendation: ${primaryRecommendation}`,
  ];
  if (validationResult.blockers.length > 0) {
    summaryParts.push(`Blockers: ${validationResult.blockers.slice(0, 3).join("; ")}`);
  }

  return {
    analysisId: `analysis-${group.groupId}-r${group.roundNumber}`,
    groupId: group.groupId,
    roundNumber: group.roundNumber,
    rootCauses,
    primaryRecommendation,
    recommendations,
    shouldRerun,
    shouldRedesign,
    shouldStop,
    suggestedFixes,
    summaryForMainBrain: summaryParts.join("\n"),
    analyzedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------------
// Pattern detection helpers
// -------------------------------------------------------------------

function isOOM(worker: WorkerRun): boolean {
  const signals = [
    worker.exitCode === 137,
    worker.exitCode === 9,
    /out of memory|oom|cuda.*out.*memory|memory.*alloc/i.test(worker.logTail),
    /RuntimeError.*CUDA/i.test(worker.logTail),
  ];
  return signals.some(Boolean);
}

function extractOOMInfo(worker: WorkerRun): string {
  const match = worker.logTail.match(/(?:out of memory|oom|cuda.*memory)[^\n]*/i);
  return match ? match[0].slice(0, 200) : `exit code ${worker.exitCode}`;
}

function isTimeout(worker: WorkerRun): boolean {
  return /timeout|time.?limit|walltime.*exceed/i.test(worker.logTail) ||
    worker.exitCode === 124;
}

function isInfraFailure(worker: WorkerRun): boolean {
  const patterns = [
    /connection.*refused|ssh.*fail|host.*not.*found/i,
    /node.*unavailable|partition.*down/i,
    /resource.*unavailable|allocation.*fail/i,
    /slurm.*error|rjob.*error.*submit/i,
    /nccl.*error|distributed.*init.*fail/i,
  ];
  const text = `${worker.logTail} ${worker.error ?? ""}`;
  return patterns.some(p => p.test(text));
}

function isDataIssue(worker: WorkerRun): boolean {
  const patterns = [
    /file.*not.*found|no.*such.*file/i,
    /data.*load.*error|dataset.*error/i,
    /json.*decode.*error|csv.*parse/i,
    /corrupt|checksum.*mismatch/i,
    /permission.*denied.*data/i,
  ];
  const text = `${worker.logTail} ${worker.error ?? ""}`;
  return patterns.some(p => p.test(text));
}

function extractDataError(worker: WorkerRun): string {
  const text = `${worker.logTail} ${worker.error ?? ""}`;
  const match = text.match(/(?:file.*not.*found|data.*error|dataset.*error|corrupt)[^\n]*/i);
  return match ? match[0].slice(0, 200) : "Data-related failure";
}

// -------------------------------------------------------------------
// Convenience: should we stop after repeated failures?
// -------------------------------------------------------------------

export function shouldStopExecution(
  rounds: Array<{ validationResult: ExecutionValidationResult | null; analysisResult: ExperimentAnalysisResult | null }>,
  maxConsecutiveFailures = 3,
): { shouldStop: boolean; reason: string } {
  let consecutiveFailures = 0;

  for (let i = rounds.length - 1; i >= 0; i--) {
    const vr = rounds[i].validationResult;
    if (!vr || vr.verdict === "fail") {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  if (consecutiveFailures >= maxConsecutiveFailures) {
    return {
      shouldStop: true,
      reason: `${consecutiveFailures} consecutive failed rounds. Repeated failures suggest a fundamental issue.`,
    };
  }

  // Check if the latest analysis recommends stopping
  const latest = rounds[rounds.length - 1]?.analysisResult;
  if (latest?.shouldStop) {
    return { shouldStop: true, reason: latest.summaryForMainBrain };
  }

  // Check for hypothesis falsification
  const negativeResults = rounds.filter(
    r => r.analysisResult?.rootCauses.some(c => c.category === "negative_scientific_result" && c.confidence > 0.7)
  );
  if (negativeResults.length >= 2) {
    return {
      shouldStop: true,
      reason: "Multiple rounds indicate a negative scientific result. The hypothesis may be falsified.",
    };
  }

  return { shouldStop: false, reason: "" };
}
