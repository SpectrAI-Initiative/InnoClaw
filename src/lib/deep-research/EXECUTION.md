# Execution Pipeline — Developer Guide

## Architecture Overview

The execution pipeline converts approved research plans into runnable experiments through a staged process:

```
ValidationPlan → ExperimentSpec → Data Acquisition → Preprocessing → Job Submission
                      ↓                   ↓                ↓              ↓
                  DryRunResult    DatasetManifest   PreprocessManifest  JobResult
                      ↓                   ↓                ↓              ↓
                  ────────────── ExperimentManifest (updated at every stage) ──────
```

### Modules

| Module | Purpose |
|--------|---------|
| `exec-pipeline.ts` | Main orchestrator — wires plan → data → preprocess → submit |
| `exec-config.ts` | Configuration resolution with defaults and overrides |
| `exec-job-submitter.ts` | Job submission adapters (mock, rjob, slurm) |
| `exec-dataset-manager.ts` | Dataset download with caching and skip-if-exists |
| `exec-preprocess-runner.ts` | Step-level preprocessing with per-step caching |
| `exec-manifest.ts` | Experiment manifest for reproducibility |
| `exec-readiness.ts` | Readiness checks, dry-run, resource estimation, pilot/full templates |

---

## How a Research Plan Becomes an Executable Plan

1. **ValidationPlan** is approved after reviewer deliberation
2. `buildExperimentSpec(session, validationPlan)` converts it to an `ExperimentSpec`:
   - Extracts datasets → `DataSourceSpec[]`
   - Extracts commands → `ExperimentCommand[]`
   - Merges resources with config defaults
   - Sets up preprocessing pipeline
   - Assigns output directories
3. `checkExecutionReadiness()` validates the spec for blockers
4. `generateDryRun()` renders what would happen without executing

```typescript
import { generateExecutionSpec } from "./exec-pipeline";

const { spec, dryRun, readiness } = generateExecutionSpec(session, validationPlan);
// readiness.ready → true/false
// dryRun.renderedJobSpec → human-readable job spec
// dryRun.blockers → what's missing
```

---

## Dataset Acquisition

### Supported Sources

| Source | Identifier Pattern | Example |
|--------|-------------------|---------|
| HuggingFace | `org/dataset` or `hf://org/dataset` | `gsm8k`, `meta-llama/Llama-2-7b` |
| GitHub | `https://github.com/org/repo` | `https://github.com/openai/evals` |
| URL | Any HTTP(S) URL | `https://example.com/data.tar.gz` |
| Local | Absolute path | `/mnt/data/my-dataset` |

### How It Works

1. `buildDatasetAcquisitionPlan()` checks each source against cache
2. Sources already in cache are marked `willSkip: true`
3. `executeDatasetAcquisition()` runs download commands for non-cached sources
4. Returns `DatasetAcquisitionResult[]` with status per source

```typescript
import { buildDatasetAcquisitionPlan, executeDatasetAcquisition } from "./exec-dataset-manager";

const plan = buildDatasetAcquisitionPlan(spec, config);
// plan.sourcesToDownload → 2, plan.sourcesToSkip → 1

const results = await executeDatasetAcquisition(spec, config);
// results[0].status → "ready" | "skipped" | "failed"
```

### Cache Behavior

- Default cache: `/mnt/shared-storage-user/suencheng/data-cache/`
- Skip-if-exists: checks if cache path has content
- Override checker for tests: `setFileExistenceChecker(path => ...)`
- Override executor for tests: `setCommandExecutor(async cmd => ...)`

---

## Preprocessing Pipeline

### Defining Steps

Steps are declared in `PreprocessingPipelineSpec`:

```typescript
spec.preprocessing = {
  enabled: true,
  steps: [
    { order: 1, name: "validate", type: "validate", config: { requiredFields: ["text"] }, description: "Check fields" },
    { order: 2, name: "dedup", type: "dedup", config: { method: "exact", fields: ["text"] }, description: "Remove dupes" },
    { order: 3, name: "filter", type: "filter", config: { field: "text", minLength: 10 }, description: "Min length" },
    { order: 4, name: "split", type: "split", config: { trainRatio: 0.9, valRatio: 0.05, seed: 42 }, description: "Split" },
  ],
  outputPath: "/mnt/data/preprocessed/exp-001",
  outputFormat: "jsonl",
  skipIfCached: true,
};
```

### Supported Step Types

| Type | Config Keys | What It Does |
|------|-------------|-------------|
| `validate` | `requiredFields: string[]` | Drops records missing required fields |
| `filter` | `field`, `minLength`, `maxLength` | Filters by field length |
| `transform` | `operations: string[]` | `lowercase`, `strip`, `normalize_whitespace` |
| `dedup` | `method`, `fields`, `threshold` | Exact or fuzzy deduplication |
| `split` | `trainRatio`, `valRatio`, `seed` | Train/val/test split |
| `sample` | `n`, `seed` | Random sample |
| `tokenize` | `tokenizer` | HuggingFace tokenizer |
| `custom` | `script` | Arbitrary bash script |

### Cache Invalidation

Each step's config is hashed (`hashStepConfig()`). If the output exists AND the config hash matches the stored hash, the step is skipped. Change any config field and the step re-runs.

### Test Overrides

```typescript
import { setFileChecker, setCommandRunner, setHashReader, resetRunnerOverrides } from "./exec-preprocess-runner";

setFileChecker(path => false);        // Nothing exists
setHashReader(path => null);          // No cached hashes
setCommandRunner(async cmd => ({      // Mock execution
  stdout: "Processed 100 records",
  exitCode: 0,
}));
```

---

## rjob Spec Building

### From ExperimentSpec to Manifest

```typescript
import { specToRJobManifest, specToSlurmManifest, renderJobSpec } from "./exec-job-submitter";

const rjobManifest = specToRJobManifest(spec);
// { launcherType: "rjob", jobName: "...", gpu: 4, ... }

const slurmManifest = specToSlurmManifest(spec);
// { launcherType: "slurm", partition: "gpu", ... }

const readable = renderJobSpec(spec);
// Human-readable text with resources, commands, data sources
```

### Submission Adapters

| Adapter | Class | When Used |
|---------|-------|-----------|
| Mock | `MockSubmissionAdapter` | Tests, local development |
| rjob | `RJobSubmissionAdapter` | Real cluster submission |
| Registry | `getSubmissionAdapter(type)` | Dynamic dispatch |

```typescript
const adapter = new MockSubmissionAdapter();
const result = await adapter.submit(spec, "mock");
// result.success → true, result.jobId → "mock-job-1"

const status = await adapter.queryStatus(result.jobId);
// status.status → "running" → "completed" (progresses on each query)
```

---

## Dry-Run vs Mock vs Real

| Mode | Data Downloaded? | Preprocessing Runs? | Job Submitted? | Use Case |
|------|-----------------|---------------------|----------------|----------|
| `dry_run` | No | No | No | Inspect what would happen |
| `mock` | Yes (mock executor) | Yes (mock runner) | Yes (mock adapter) | Integration testing |
| `real` | Yes (real commands) | Yes (real commands) | Yes (real cluster) | Production |

```typescript
// Dry-run: just render the plan
const spec = buildExperimentSpec(session, plan, config, { submissionMode: "dry_run" });
const result = await executePipeline(spec);
// result.status → "dry_run", result.dryRun → DryRunResult

// Mock: full pipeline with mock backends
const spec = buildExperimentSpec(session, plan, config, { submissionMode: "mock" });
const result = await executePipeline(spec);
// result.status → "submitted", result.submissionResult.jobId → "mock-job-1"
```

---

## Mock Mode in Tests

All external dependencies are injectable:

```typescript
// Dataset downloads
setFileExistenceChecker(path => false);
setCommandExecutor(async cmd => ({ stdout: "OK", exitCode: 0 }));

// Preprocessing
setFileChecker(path => false);
setHashReader(path => null);
setCommandRunner(async cmd => ({ stdout: "OK", exitCode: 0 }));

// Job submission
const adapter = new MockSubmissionAdapter({ shouldFail: false });
```

No real cluster access, no large downloads, no filesystem side effects.

---

## Cluster-Specific Assumptions

- **rjob**: Assumes `rjob submit` CLI is available on the cluster
- **Slurm**: Assumes `sbatch`/`srun`/`salloc` are available
- **Mounts**: Default GPFS mounts are cluster-specific — override via config
- **Charged group**: `ai4sdata_gpu` is the default billing group
- **Docker images**: rjob adapter references `registry.example.com/research:latest` — must be configured

---

## End-to-End Example

### 1. Dataset Source

```json
{
  "id": "ds-0",
  "name": "gsm8k",
  "source": "huggingface",
  "identifier": "gsm8k",
  "estimatedSizeGb": 0.1,
  "cachePath": "/mnt/data/cache/gsm8k"
}
```

### 2. Preprocessing Config

```json
{
  "enabled": true,
  "steps": [
    { "order": 1, "name": "validate", "type": "validate", "config": { "requiredFields": ["question", "answer"] } },
    { "order": 2, "name": "dedup", "type": "dedup", "config": { "method": "exact", "fields": ["question"] } },
    { "order": 3, "name": "split", "type": "split", "config": { "trainRatio": 0.9, "valRatio": 0.05, "seed": 42 } }
  ],
  "outputPath": "/mnt/data/preprocessed/exp-001",
  "outputFormat": "jsonl",
  "skipIfCached": true
}
```

### 3. Generated Execution Plan

```
# Experiment: Evaluate LLM reasoning on math benchmarks
# ID: exp-sess-001-1
# Scale: pilot
# Launcher: rjob
# Mode: mock

## Resources
GPU: 4
CPU: 32
Memory: 256000 MB
Walltime: 24:00:00

## Data Sources
- gsm8k: huggingface://gsm8k → /mnt/data/cache/gsm8k
- math: huggingface://math → /mnt/data/cache/math

## Preprocessing
  1. validate (validate): Validate input records
  2. dedup (dedup): Remove exact duplicates
  3. filter (filter): Filter short records

## Commands
  [setup] Download GSM8K dataset: python download_gsm8k.py
  [train] Fine-tune on CoT data: torchrun --nproc_per_node=4 train.py
  [eval] Evaluate on test set: python eval.py --benchmark gsm8k
```

### 4. Generated rjob Spec

```bash
rjob submit \
  --job-name=Evaluate_LLM_reasoning_on_math_benchmarks \
  --gpu=4 --memory=256000 --cpu=32 \
  --charged-group=ai4sdata_gpu \
  --private-machine=yes \
  --image=registry.example.com/research:latest \
  -- bash -exc "cd /mnt/data/experiments/exp-001 && torchrun --nproc_per_node=4 train.py && python eval.py --benchmark gsm8k"
```

### 5. Expected Outputs

```
/mnt/data/experiments/exp-001/
├── checkpoints/
│   ├── checkpoint-100/
│   └── checkpoint-final/
├── logs/
│   ├── train.log
│   └── eval.log
├── metrics/
│   ├── train_metrics.json
│   └── eval_results.json
└── manifest.json
```

---

## Test Coverage

**205+ tests** across 5 test files:

| File | Tests | Coverage |
|------|-------|---------|
| `execution-pipeline.test.ts` | 65 | Config, submitter, datasets, preprocessing, manifests, readiness, pipeline orchestration |
| `execution-loop.test.ts` | 55 | Worker aggregation, validation, failure analysis, round management, lineage, remote executor, SSH adapter, grouped pipeline, skill library |
| `scientific-reviewer.test.ts` | 45 | Dimensions, anti-patterns, issue tracking, acceptance gating, anti-loop |
| `synthesis-and-routing.test.ts` | 22 | Evidence cards, claim maps, skill library, preprocessing recipes |
| `execution-plane.test.ts` | 18 | Slurm manifests, execution plans, data acquisition commands |

---

## Execution-and-Feedback Loop

The execution loop extends the single-shot pipeline with iterative plan → execute → validate → analyze → replan cycles.

### Architecture

```
                    ┌─────────────────────────────────────────────────┐
                    │                  Main Brain                      │
                    │  (replanning, strategy selection, stop decision) │
                    └──────────┬────────────────────────┬─────────────┘
                               │                        ▲
                    ┌──────────▼──────────┐  ┌──────────┴──────────┐
                    │  Execution Planner   │  │  Experiment Analysis │
                    │  - Worker fanout     │  │  - Root cause diag   │
                    │  - Parameter space   │  │  - Replan recommend  │
                    │  - Validation rules  │  │  - Stop conditions   │
                    └──────────┬──────────┘  └──────────▲──────────┘
                               │                        │
                    ┌──────────▼──────────┐  ┌──────────┴──────────┐
                    │  Round Manager       │  │  Execution Validator │
                    │  - Build groups      │  │  - Metric thresholds │
                    │  - Submit workers    │  │  - Artifact checks   │
                    │  - Poll statuses     │  │  - Variance checks   │
                    │  - Collect results   │  │  - Baseline compare  │
                    └──────────┬──────────┘  └──────────▲──────────┘
                               │                        │
                    ┌──────────▼──────────┐  ┌──────────┴──────────┐
                    │  Submission Adapters  │  │  Worker Aggregator   │
                    │  - Mock              │  │  - Mean/std/CV       │
                    │  - rjob              │  │  - Outlier removal   │
                    │  - rlaunch           │  │  - Per-group metrics │
                    │  - SSH               │  │                      │
                    └─────────────────────┘  └─────────────────────┘
```

### New Modules

| Module | Purpose |
|--------|---------|
| `execution-round-manager.ts` | Worker fanout creation, group building, submission, polling, collection, round lifecycle |
| `worker-aggregator.ts` | Combines metrics across workers: mean, std, min, max, median, CV |
| `execution-validator.ts` | Validates results against criteria: metric thresholds, artifacts, variance, baselines |
| `experiment-analysis.ts` | Diagnoses failures: OOM, timeout, infrastructure, data issues, negative results |
| `remote-executor.ts` | SSH-based remote execution with injectable runners |
| `execution-planner.ts` (extended) | Worker fanout planning, validation criteria builder, aggregation rules, retry policies |
| `scientific-reviewer.ts` (extended) | Execution readiness review, validation adequacy, resource realism, analysis quality |

### How Plans Become Experiments

1. **ValidationPlan** approved by scientific reviewers
2. `generateExecutionPlan()` converts plan → `ExecutionPlanFull` (LLM-generated)
3. `inferDecompositionStrategy()` decides seed_sweep / hyperparameter_sweep / ablation / etc.
4. `buildWorkerFanoutPlan()` creates a `WorkerFanoutPlan` with:
   - `parentSpec`: base ExperimentSpec
   - `parameterSpace`: array of `{name, values}` (e.g., `[{name: "seed", values: [42, 123, 456]}]`)
   - `validationCriteria`: metric thresholds, min workers, variance limits
   - `aggregationRules`: how to combine metrics
5. `buildExperimentDAG()` may split into pilot + full stages for expensive plans

```typescript
import { buildWorkerFanoutPlan, inferDecompositionStrategy } from "./execution-planner";

const strategy = inferDecompositionStrategy(validationPlan);
// → "seed_sweep" | "hyperparameter_sweep" | "ablation" | ...

const fanoutPlan = buildWorkerFanoutPlan(executionPlan, session, {
  strategy,
  seeds: [42, 123, 456],
  validationCriteria: {
    metricThresholds: [{ metric: "accuracy", operator: "gte", value: 0.8 }],
    minSuccessfulWorkers: 2,
  },
});
```

### Worker Decomposition

Workers are created from the parameter space cross-product:

```typescript
import { createWorkerRuns, buildExperimentGroup } from "./execution-round-manager";

// parameterSpace: [{name: "seed", values: [42, 123]}, {name: "lr", values: [1e-3, 1e-4]}]
// → 4 workers: seed=42,lr=1e-3 | seed=42,lr=1e-4 | seed=123,lr=1e-3 | seed=123,lr=1e-4

const group = buildExperimentGroup("session-1", 1, fanoutPlan);
// group.workers → WorkerRun[] with paramOverrides
```

Dependency types:
- **independent**: all workers run in parallel
- **sequential**: workers run one after another
- **staged_dag**: workers organized into stages with dependencies

### rjob / rlaunch / SSH Execution

```typescript
import { MockSubmissionAdapter, RJobSubmissionAdapter } from "./exec-job-submitter";
import { SSHSubmissionAdapter } from "./remote-executor";

// Mock (for tests)
const mock = new MockSubmissionAdapter();

// Real rjob cluster
const rjob = new RJobSubmissionAdapter({ chargedGroup: "ai4sdata_gpu" });

// SSH remote execution
const ssh = new SSHSubmissionAdapter({
  host: "gpu-cluster.example.com",
  username: "researcher",
  launcherType: "rjob",
});

// All adapters share the same interface:
const result = await adapter.submit(spec, "real");
const status = await adapter.queryStatus(result.jobId!);
const logs = await adapter.fetchLogs?.(result.jobId!);
```

### Output Collection and Validation

```typescript
import { aggregateWorkerResults } from "./worker-aggregator";
import { validateExperimentResults } from "./execution-validator";

// Aggregate across workers
const aggregated = aggregateWorkerResults(group);
// aggregated.metrics → { accuracy: { mean: 0.85, std: 0.02, ... }, loss: { ... } }

// Validate against criteria
const validation = validateExperimentResults(group, aggregated, criteria);
// validation.verdict → "pass" | "fail" | "inconclusive"
// validation.reasons → ["Metric accuracy (0.85) >= threshold (0.80)"]
// validation.blockers → [] (empty if pass)
```

### Failure → Analysis Flow

When validation fails, the experiment analysis module diagnoses root causes:

```typescript
import { analyzeExperimentFailure, shouldStopExecution } from "./experiment-analysis";

const analysis = analyzeExperimentFailure(group, aggregated, validationResult);
// analysis.rootCauses → [{ category: "oom", confidence: 0.9, ... }]
// analysis.primaryRecommendation → "increase_resources"
// analysis.shouldRerun → true
// analysis.suggestedChanges → { resources: { memoryMb: 64000 }, ... }

// Check if we should keep trying
const stop = shouldStopExecution(rounds, 3);
// stop.shouldStop → false
// stop.reason → null
```

Failure categories detected:
- **oom**: Exit code 137, CUDA OOM in logs
- **timeout**: Walltime exceeded
- **infrastructure_failure**: SSH errors, launcher failures
- **data_issue**: Missing files, corrupt data
- **negative_scientific_result**: Experiment ran but hypothesis is wrong
- **unstable_training**: Loss divergence, NaN values
- **metric_mismatch**: Wrong metrics reported

### Main Brain Replanning

After analysis, the Main Brain can revise the plan and trigger a new round:

```typescript
import { createExecutionLineage, addRoundToLineage, checkStopConditions } from "./execution-round-manager";

// Create lineage tracker across rounds
const lineage = createExecutionLineage("session-1", "exp-1", { maxRounds: 5 });

// After each round
addRoundToLineage(lineage, round);

// Check stop conditions
const stop = checkStopConditions(lineage);
// stop.shouldStop → false (continue)
// stop.reason → null

// Generate summary for Main Brain prompt
const summary = summarizeLineageForMainBrain(lineage);
// Formatted markdown with all rounds, verdicts, metrics, recommendations
```

### End-to-End Execution Loop Example

```typescript
import { executeGroupedPipeline } from "./exec-pipeline";
import { buildWorkerFanoutPlan } from "./execution-planner";

// 1. Build fanout plan
const fanoutPlan = buildWorkerFanoutPlan(executionPlan, session, {
  strategy: "seed_sweep",
  seeds: [42, 123, 456],
});

// 2. Run full grouped pipeline
const result = await executeGroupedPipeline(fanoutPlan);
// Pipeline stages: readiness → data → preprocess → build group →
//   submit workers → poll → collect → aggregate → validate → analyze

// 3. Check result
if (result.validation?.verdict === "pass") {
  // Experiment succeeded! Generate final report.
} else if (result.analysis?.shouldRerun) {
  // Apply suggested changes and run next round
  const nextPlan = applyChanges(fanoutPlan, result.analysis.suggestedChanges);
  const nextResult = await executeGroupedPipeline(nextPlan);
}
```

### Execution-Aware Scientific Review

The scientific reviewer now evaluates execution artifacts:

```typescript
import {
  reviewExecutionReadiness,
  reviewValidationCriteria,
  reviewResourceAssumptions,
  reviewExperimentAnalysis,
  reviewRerunJustification,
} from "./scientific-reviewer";

// Before execution: is the plan ready?
const readiness = reviewExecutionReadiness(fanoutPlan);
// readiness.ready → true/false
// readiness.blockers → [{ category: "data", issue: "...", severity: "critical" }]

// Are validation criteria adequate?
const criteriaReview = reviewValidationCriteria(criteria, totalWorkers, "seed_sweep");
// criteriaReview.adequate → true/false

// Are resource assumptions realistic?
const resourceReview = reviewResourceAssumptions(resources, totalWorkers, estimatedGPUHours);
// resourceReview.estimatedCostCategory → "low" | "medium" | "high" | "very_high"

// After failure: was the analysis thorough?
const analysisReview = reviewExperimentAnalysis(analysis, validationResult);
// analysisReview.quality → "good" | "acceptable" | "weak" | "poor"

// Is a rerun scientifically justified?
const rerunReview = reviewRerunJustification(analysis, currentRound, maxRounds, failures);
// rerunReview.recommendation → "approve_with_changes" | "stop" | ...
```
