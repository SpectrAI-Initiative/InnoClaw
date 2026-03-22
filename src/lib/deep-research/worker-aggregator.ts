// =============================================================
// Worker Aggregator — Combine results from multi-worker runs
// =============================================================
// Aggregates metrics, artifacts, and status across all workers
// in an ExperimentGroup to produce a unified AggregatedResult.

import type {
  ExperimentGroup,
  AggregatedResult,
  AggregatedMetric,
  AggregationRules,
} from "./types";

// -------------------------------------------------------------------
// Main aggregation function
// -------------------------------------------------------------------

/**
 * Aggregate results from all completed workers in a group.
 */
export function aggregateWorkerResults(
  group: ExperimentGroup,
  rules?: AggregationRules,
): AggregatedResult {
  const effectiveRules = rules ?? group.aggregationRules;
  const completedWorkers = group.workers.filter(w => w.status === "completed");
  const failedWorkers = group.workers.filter(w => w.status === "failed" || w.status === "timeout");

  // Collect all metric keys across workers
  const allMetricKeys = new Set<string>();
  for (const worker of completedWorkers) {
    for (const key of Object.keys(worker.metrics)) {
      allMetricKeys.add(key);
    }
  }

  // Filter to only configured metrics if specified
  const metricsToAggregate = effectiveRules.metricsToAggregate.length > 0
    ? effectiveRules.metricsToAggregate
    : Array.from(allMetricKeys);

  // Aggregate each metric
  const metrics: Record<string, AggregatedMetric> = {};
  for (const metricKey of metricsToAggregate) {
    const values = completedWorkers
      .map(w => w.metrics[metricKey])
      .filter((v): v is number => v !== undefined && v !== null && isFinite(v));

    if (values.length === 0) continue;
    metrics[metricKey] = computeAggregatedMetric(values);
  }

  // Collect all artifact paths
  const allArtifactPaths = completedWorkers.flatMap(w => w.artifactPaths);

  // Build per-worker summaries
  const workerSummaries = group.workers.map(w => ({
    workerId: w.workerId,
    label: w.label,
    status: w.status,
    metrics: w.metrics,
    runtimeSec: w.runtimeSec,
  }));

  return {
    groupId: group.groupId,
    totalWorkers: group.workers.length,
    succeededWorkers: completedWorkers.length,
    failedWorkers: failedWorkers.length,
    metrics,
    allArtifactPaths,
    workerSummaries,
    aggregatedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------------
// Metric computation
// -------------------------------------------------------------------

/**
 * Compute aggregated statistics for a set of values.
 */
export function computeAggregatedMetric(values: number[]): AggregatedMetric {
  if (values.length === 0) {
    return { mean: 0, std: 0, min: 0, max: 0, median: 0, values: [], coefficientOfVariation: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1
    ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
    : 0;
  const std = Math.sqrt(variance);
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  const coefficientOfVariation = mean !== 0 ? std / Math.abs(mean) : 0;

  return {
    mean,
    std,
    min: sorted[0],
    max: sorted[n - 1],
    median,
    values: [...values],
    coefficientOfVariation,
  };
}

// -------------------------------------------------------------------
// Group status computation
// -------------------------------------------------------------------

/**
 * Determine the overall status of an experiment group based on its workers.
 */
export function computeGroupStatus(
  group: ExperimentGroup,
): ExperimentGroup["status"] {
  const statuses = group.workers.map(w => w.status);
  const total = statuses.length;

  if (total === 0) return "pending";

  const completed = statuses.filter(s => s === "completed").length;
  const failed = statuses.filter(s => s === "failed" || s === "timeout").length;
  const running = statuses.filter(s => s === "running" || s === "queued").length;
  const pending = statuses.filter(s => s === "pending").length;
  const cancelled = statuses.filter(s => s === "cancelled").length;

  if (cancelled === total) return "cancelled";
  if (running > 0 || pending > 0) return "running";
  if (completed === total) return "completed";
  if (failed === total) return "failed";
  if (completed > 0 && failed > 0) return "partially_failed";
  if (failed > 0) return "failed";

  return "completed";
}

// -------------------------------------------------------------------
// Summary generation
// -------------------------------------------------------------------

/**
 * Generate a human-readable summary of aggregated results.
 */
export function summarizeAggregatedResult(result: AggregatedResult): string {
  const lines: string[] = [];

  lines.push(`## Experiment Group: ${result.groupId}`);
  lines.push(`Workers: ${result.succeededWorkers}/${result.totalWorkers} succeeded, ${result.failedWorkers} failed`);
  lines.push("");

  if (Object.keys(result.metrics).length > 0) {
    lines.push("### Aggregated Metrics");
    for (const [key, metric] of Object.entries(result.metrics)) {
      lines.push(
        `- **${key}**: mean=${metric.mean.toFixed(4)}, std=${metric.std.toFixed(4)}, ` +
        `range=[${metric.min.toFixed(4)}, ${metric.max.toFixed(4)}], CV=${metric.coefficientOfVariation.toFixed(3)}`
      );
    }
    lines.push("");
  }

  if (result.workerSummaries.length > 0) {
    lines.push("### Per-Worker Summary");
    for (const ws of result.workerSummaries) {
      const metricsStr = Object.entries(ws.metrics).map(([k, v]) => `${k}=${v.toFixed(4)}`).join(", ");
      lines.push(`- ${ws.label} [${ws.status}]: ${metricsStr || "no metrics"} (${ws.runtimeSec ?? "?"}s)`);
    }
  }

  return lines.join("\n");
}

// -------------------------------------------------------------------
// Default aggregation rules
// -------------------------------------------------------------------

export function createDefaultAggregationRules(
  overrides?: Partial<AggregationRules>,
): AggregationRules {
  return {
    metricAggregation: "mean",
    minSuccessRate: 0.5,
    metricsToAggregate: [],
    computeVariance: true,
    maxCoefficientOfVariation: null,
    customAggregator: null,
    ...overrides,
  };
}
