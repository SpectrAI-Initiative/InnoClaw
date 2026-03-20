// =============================================================
// Execution Validator — Structured experiment output validation
// =============================================================
// Checks whether experiment outputs satisfy acceptance criteria:
//   - job completion status
//   - required artifacts present
//   - metrics meet thresholds
//   - worker success rates
//   - baseline comparisons
//   - cross-seed variance

import type {
  ExperimentGroup,
  WorkerRun,
  AggregatedResult,
  ValidationCriteria,
  ExecutionValidationResult,
  ValidationVerdict,
  AggregatedMetric,
} from "./types";

// -------------------------------------------------------------------
// Main validation function
// -------------------------------------------------------------------

/**
 * Validate an experiment group's results against its criteria.
 * Returns a structured verdict with reasons and suggestions.
 */
export function validateExperimentResults(
  group: ExperimentGroup,
  aggregated: AggregatedResult,
  criteria?: ValidationCriteria,
): ExecutionValidationResult {
  const effectiveCriteria = criteria ?? group.validationCriteria;
  const criterionResults: ExecutionValidationResult["criterionResults"] = [];
  const missingArtifacts: string[] = [];
  const metricComparisons: ExecutionValidationResult["metricComparisons"] = [];
  const reasons: string[] = [];
  const blockers: string[] = [];

  // 1. Check worker success rate
  const successRate = aggregated.totalWorkers > 0
    ? aggregated.succeededWorkers / aggregated.totalWorkers
    : 0;
  const minRequired = effectiveCriteria.minSuccessfulWorkers;
  const workerCheckPassed = aggregated.succeededWorkers >= minRequired;

  criterionResults.push({
    criterion: "worker_success_rate",
    passed: workerCheckPassed,
    actual: `${aggregated.succeededWorkers}/${aggregated.totalWorkers} workers succeeded (${(successRate * 100).toFixed(0)}%)`,
    expected: `>= ${minRequired} successful workers`,
    note: workerCheckPassed ? "Sufficient workers completed" : "Too many workers failed",
  });

  if (!workerCheckPassed) {
    blockers.push(`Only ${aggregated.succeededWorkers}/${aggregated.totalWorkers} workers succeeded (need ${minRequired})`);
  }

  // 2. Check required artifacts
  for (const pattern of effectiveCriteria.requiredArtifacts) {
    const found = aggregated.allArtifactPaths.some(p => matchesPattern(p, pattern));
    criterionResults.push({
      criterion: `artifact:${pattern}`,
      passed: found,
      actual: found ? "found" : "missing",
      expected: pattern,
      note: found ? "" : `Required artifact pattern '${pattern}' not found in outputs`,
    });
    if (!found) {
      missingArtifacts.push(pattern);
      blockers.push(`Missing required artifact: ${pattern}`);
    }
  }

  // 3. Check metric thresholds
  for (const threshold of effectiveCriteria.metricThresholds) {
    const metricData = aggregated.metrics[threshold.metric];
    if (!metricData) {
      criterionResults.push({
        criterion: `metric:${threshold.metric}`,
        passed: false,
        actual: "not found",
        expected: `${threshold.operator} ${threshold.value}`,
        note: `Metric '${threshold.metric}' not found in results`,
      });
      blockers.push(`Metric '${threshold.metric}' not found in experiment outputs`);
      metricComparisons.push({
        metric: threshold.metric,
        actual: NaN,
        threshold: threshold.value,
        operator: threshold.operator,
        passed: false,
      });
      continue;
    }

    const actual = metricData.mean;
    const passed = evaluateThreshold(actual, threshold.operator, threshold.value, threshold.upperBound);

    criterionResults.push({
      criterion: `metric:${threshold.metric}`,
      passed,
      actual: `${actual.toFixed(4)} (std=${metricData.std.toFixed(4)})`,
      expected: formatThreshold(threshold.operator, threshold.value, threshold.upperBound),
      note: passed ? "" : `Metric ${threshold.metric}=${actual.toFixed(4)} does not meet threshold`,
    });

    metricComparisons.push({
      metric: threshold.metric,
      actual,
      threshold: threshold.value,
      operator: threshold.operator,
      passed,
    });

    if (!passed) {
      blockers.push(`Metric '${threshold.metric}' = ${actual.toFixed(4)}, expected ${formatThreshold(threshold.operator, threshold.value, threshold.upperBound)}`);
    }
  }

  // 4. Check cross-seed variance
  if (effectiveCriteria.maxVariance !== null && effectiveCriteria.maxVariance !== undefined) {
    for (const [metricName, metricData] of Object.entries(aggregated.metrics)) {
      if (metricData.values.length < 2) continue;
      const cv = metricData.coefficientOfVariation;
      const varianceOk = cv <= effectiveCriteria.maxVariance;

      criterionResults.push({
        criterion: `variance:${metricName}`,
        passed: varianceOk,
        actual: `CV=${cv.toFixed(4)}`,
        expected: `CV <= ${effectiveCriteria.maxVariance}`,
        note: varianceOk ? "" : `High variance in ${metricName} across workers`,
      });

      if (!varianceOk) {
        reasons.push(`High variance in '${metricName}' (CV=${cv.toFixed(4)}): results may not be stable`);
      }
    }
  }

  // 5. Check baseline comparison
  if (effectiveCriteria.baselineRequired && Object.keys(effectiveCriteria.baselineMetrics).length > 0) {
    for (const [metricName, baselineValue] of Object.entries(effectiveCriteria.baselineMetrics)) {
      const metricData = aggregated.metrics[metricName];
      if (!metricData) {
        criterionResults.push({
          criterion: `baseline:${metricName}`,
          passed: false,
          actual: "not found",
          expected: `> baseline (${baselineValue})`,
          note: `Cannot compare to baseline: metric '${metricName}' missing`,
        });
        blockers.push(`Baseline comparison failed: metric '${metricName}' not found`);
        continue;
      }

      const beatsBaseline = metricData.mean > baselineValue;
      criterionResults.push({
        criterion: `baseline:${metricName}`,
        passed: beatsBaseline,
        actual: `${metricData.mean.toFixed(4)}`,
        expected: `> ${baselineValue} (baseline)`,
        note: beatsBaseline ? `Beats baseline by ${((metricData.mean - baselineValue) / baselineValue * 100).toFixed(1)}%` : "Below baseline",
      });

      if (!beatsBaseline) {
        blockers.push(`Metric '${metricName}' = ${metricData.mean.toFixed(4)} does not beat baseline ${baselineValue}`);
      }
    }
  }

  // 6. Custom conditions (noted but not auto-evaluated)
  for (const condition of effectiveCriteria.customConditions) {
    criterionResults.push({
      criterion: `custom:${condition.slice(0, 50)}`,
      passed: true, // Cannot auto-evaluate; mark as needing human/LLM review
      actual: "requires manual review",
      expected: condition,
      note: "Custom condition — needs human or LLM evaluation",
    });
    reasons.push(`Custom condition pending review: ${condition}`);
  }

  // Determine overall verdict
  const failedCriteria = criterionResults.filter(c => !c.passed);
  const hasBlockers = blockers.length > 0;
  const hasCustomPending = effectiveCriteria.customConditions.length > 0;

  let verdict: ValidationVerdict;
  let severity: ExecutionValidationResult["severity"];

  if (failedCriteria.length === 0 && !hasCustomPending) {
    verdict = "pass";
    severity = "none";
    reasons.push("All validation criteria met");
  } else if (hasBlockers) {
    // Check if it's a hard fail or just inconclusive
    const criticalFails = failedCriteria.filter(c =>
      c.criterion.startsWith("worker_") || c.criterion.startsWith("artifact:")
    );
    if (criticalFails.length > 0) {
      verdict = "fail";
      severity = "critical";
    } else if (failedCriteria.length > failedCriteria.length / 2) {
      verdict = "fail";
      severity = "major";
    } else {
      verdict = "inconclusive";
      severity = "minor";
    }
  } else {
    verdict = "inconclusive";
    severity = "minor";
    reasons.push("Some criteria could not be automatically evaluated");
  }

  // Build suggestions
  const retrySuggestion = verdict === "fail" && blockers.some(b => b.includes("workers failed"))
    ? "Some workers failed — consider rerunning with more resources or debugging the failing workers"
    : null;

  const replanSuggestion = verdict === "fail" && blockers.some(b => b.includes("does not meet threshold"))
    ? "Key metrics did not meet thresholds — consider revising the experiment design or hypothesis"
    : null;

  const confidenceScore = criterionResults.length > 0
    ? criterionResults.filter(c => c.passed).length / criterionResults.length
    : 0;

  return {
    verdict,
    confidenceScore,
    criterionResults,
    missingArtifacts,
    metricComparisons,
    reasons,
    blockers,
    retrySuggestion,
    replanSuggestion,
    severity,
    validatedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------------
// Quick validation for a single worker run
// -------------------------------------------------------------------

export function validateSingleWorker(worker: WorkerRun): {
  passed: boolean;
  reason: string;
} {
  if (worker.status !== "completed") {
    return { passed: false, reason: `Worker ${worker.workerId} status: ${worker.status}` };
  }
  if (worker.exitCode !== null && worker.exitCode !== 0) {
    return { passed: false, reason: `Worker ${worker.workerId} exit code: ${worker.exitCode}` };
  }
  if (Object.keys(worker.metrics).length === 0) {
    return { passed: false, reason: `Worker ${worker.workerId} produced no metrics` };
  }
  return { passed: true, reason: "Worker completed successfully with metrics" };
}

// -------------------------------------------------------------------
// Create default validation criteria
// -------------------------------------------------------------------

export function createDefaultValidationCriteria(
  overrides?: Partial<ValidationCriteria>,
): ValidationCriteria {
  return {
    metricThresholds: [],
    requiredArtifacts: [],
    minSuccessfulWorkers: 1,
    maxVariance: null,
    baselineRequired: false,
    baselineMetrics: {},
    customConditions: [],
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function evaluateThreshold(
  actual: number,
  operator: string,
  value: number,
  upperBound?: number,
): boolean {
  switch (operator) {
    case "gte": return actual >= value;
    case "lte": return actual <= value;
    case "gt": return actual > value;
    case "lt": return actual < value;
    case "eq": return Math.abs(actual - value) < 1e-9;
    case "between": return actual >= value && actual <= (upperBound ?? Infinity);
    default: return false;
  }
}

function formatThreshold(operator: string, value: number, upperBound?: number): string {
  switch (operator) {
    case "gte": return `>= ${value}`;
    case "lte": return `<= ${value}`;
    case "gt": return `> ${value}`;
    case "lt": return `< ${value}`;
    case "eq": return `== ${value}`;
    case "between": return `${value} - ${upperBound}`;
    default: return `${operator} ${value}`;
  }
}

function matchesPattern(path: string, pattern: string): boolean {
  // Simple glob-like matching
  if (pattern.startsWith("*")) {
    return path.endsWith(pattern.slice(1));
  }
  if (pattern.endsWith("*")) {
    return path.startsWith(pattern.slice(0, -1));
  }
  if (pattern.includes("*")) {
    const parts = pattern.split("*");
    let idx = 0;
    for (const part of parts) {
      const found = path.indexOf(part, idx);
      if (found < 0) return false;
      idx = found + part.length;
    }
    return true;
  }
  return path.includes(pattern);
}
