# Inno-Claw Deep Research Framework — Session Summary

## Overview

This session performed a major architectural refactor and feature expansion of the `/root/inno-claw` multi-agent deep research framework across three major phases:

1. **Phase 1**: Core architecture refactor — new synthesizer pipeline, scientific reviewer, execution planner, data acquisition, slurm launcher, state tracker, skill library routing
2. **Phase 2**: Enhanced scientific reviewer — 13 review dimensions, anti-pattern detection, persistent issue tracking, acceptance-gated progression, synthesizer-facing revision loop
3. **Phase 3**: Full execution pipeline — dataset acquisition, preprocessing, job submission, dry-run/mock modes, experiment manifests, readiness checks

---

## Phase 1: Core Architecture Refactor

### Goal

Redesign the weak "search → reviewer → repeat" pipeline into a stronger multi-role system with clear separation between retrieval, synthesis, scientific review, planning, and execution.

### New Modules Created

#### `src/lib/deep-research/scientific-reviewer.ts` (~530 lines, later rewritten to ~750 lines)
- Core scientific review module with anti-loop logic
- 10 review dimensions scored 1-5 (later expanded to 13)
- Structured blockers with repair paths and pass conditions
- Anti-loop enforcement: Round 1 max 5 critical blockers, Round 2 max 1 new, Round 3 forced terminal decision
- `buildScientificReviewPrompt()`, `executeScientificReview()`

#### `src/lib/deep-research/slurm-launcher.ts` (~185 lines)
- Slurm/sbatch launcher adapter
- `buildSlurmManifest()`, `slurmToScript()`, `slurmToCommand()`, `slurmToSrun()`, `slurmToSalloc()`
- Generates full `#!/bin/bash` sbatch scripts with `#SBATCH` directives
- Registered in global launcher registry

#### `src/lib/deep-research/execution-planner.ts` (~340 lines)
- Multi-stage execution plan generation via LLM
- `buildExecutionPlanPrompt()`, `generateExecutionPlan()`, `validateExecutionPlan()`, `executionPlanToNodeSpecs()`
- Validates dependencies, detects circular dependencies, checks for missing commands

#### `src/lib/deep-research/data-acquisition.ts` (~260 lines)
- Pure utility for generating download commands
- `buildHuggingFaceDownloadCommand()`, `buildGitHubDownloadCommand()`, `buildDataAcquisitionPlan()`
- Supports HF datasets (streaming + batch), HF models, GitHub clones, release asset downloads

#### `src/lib/deep-research/state-tracker.ts` (~400 lines)
- Consolidated project state tracking
- `buildProjectState()`, `summarizeProjectState()`, `getPhaseReadiness()`, `diffProjectStates()`
- Interfaces: `EvidenceLedger`, `SynthesisState`, `ReviewState`, `ExecutionState`, `ProjectState`

#### `src/lib/deep-research/preprocessing.ts` (~310 lines)
- Preprocessing pipeline specification
- `buildPreprocessingCommand()`, `validateRecipe()`, `generateSplitManifest()`, `estimatePreprocessingDuration()`
- Generates Python commands for filter/transform/normalize/dedup/split/sample operations

#### `src/lib/deep-research/ARCHITECTURE.md`
- Full architecture documentation for the 5-role, 12-phase system

### Modified Files

#### `src/lib/deep-research/phases/literature-synthesis.ts`
- Completely rewritten to use dedicated Synthesizer
- Collects EvidenceCards from artifacts, builds EvidenceCardCollection
- Calls `executeSynthesis()` to produce ClaimMap
- Falls back to old main_brain node execution if synthesizer fails

#### `src/lib/deep-research/phases/reviewer-deliberation.ts`
- Added dual review path: scientific review (when `config.scientificReview` is set) vs classic battle
- Scientific path uses dynamic import of `scientific-reviewer.ts`
- Falls back to classic `runReviewerBattle()` on failure

#### `src/lib/deep-research/phases/planning.ts`
- Added dynamic skill routing when `config.skillRouting.enabled = true`
- MainBrain classifies task types and selects appropriate skills from skill catalog
- Falls back to classic `callMainBrain()` if routing fails

#### `src/lib/deep-research/types.ts`
- Added `"slurm"` to `LauncherType` union
- Added `SlurmManifest` to `ExecutionManifest` union
- Added `ScientificReviewPacket`, `ScientificReviewResult`, `DimensionScore`, `ScientificBlocker`, `RepairPath`
- Added `EvidenceCard`, `EvidenceCardCollection`, `ClaimMap`, `Claim`, `Contradiction`, `GapAnalysis`
- Added `SkillDefinition`, `SkillRoutingDecision`, `ExecutionPlanFull`, `ExecutionStage`, `DataRequirement`

#### `src/lib/deep-research/model-router.ts`
- Added `synthesizer` role to `DEFAULT_ROUTES`

#### `src/lib/deep-research/execution-adapters.ts`
- Added `"slurm"` case to `manifestToCommand()` using registry lookup

### Tests Created (57 tests)

#### `src/lib/deep-research/__tests__/scientific-reviewer.test.ts` (17 tests)
- Schema validation for ScientificReviewPacket, ScientificBlocker, DimensionScore, RepairPath
- Anti-loop constraint tests

#### `src/lib/deep-research/__tests__/execution-plane.test.ts` (18 tests)
- Slurm manifest building, script/command generation
- Execution plan validation, data acquisition commands

#### `src/lib/deep-research/__tests__/synthesis-and-routing.test.ts` (22 tests)
- Evidence card building, merging, honesty assessment
- ClaimMap schema validation, preprocessing recipes, skill library coverage

---

## Phase 2: Enhanced Scientific Reviewer

### Goal

Strengthen the Reviewer Skill with more review dimensions, anti-pattern detection, persistent issue tracking across rounds, acceptance-gated progression, and a synthesizer-facing revision loop.

### Changes to `types.ts`

Added 3 new review dimensions:
```typescript
export type ReviewDimension =
  | ... // existing 10
  | "novelty_positioning"
  | "reproducibility"
  | "overclaiming_risk";
```

Added issue tracking types:
```typescript
export type ReviewIssueStatus = "open" | "partially_resolved" | "resolved" | "deferred" | "blocked";

export interface ReviewIssue {
  issueId: string;        // Persistent ID like "ISS-001"
  raisedInRound: number;
  raisedBy: "reviewer_a" | "reviewer_b";
  status: ReviewIssueStatus;
  severity: "critical" | "major" | "minor";
  title: string;
  description: string;
  resolutionCriteria: string;
  statusHistory: Array<{ round: number; status: ReviewIssueStatus; note: string }>;
  linkedBlockerIds?: string[];
}
```

Added anti-pattern detection:
```typescript
export type AntiPatternType =
  | "citation_hallucination" | "benchmark_mismatch" | "metric_cherry_picking"
  | "unfounded_generalization" | "missing_ablation" | "dataset_contamination_risk"
  | "p_hacking_risk" | "survivorship_bias" | "scope_creep" | "circular_reasoning";

export interface AntiPatternFlag {
  pattern: AntiPatternType;
  location: string;
  description: string;
  severity: "critical" | "major" | "minor";
  suggestedFix: string;
}
```

Added synthesizer-facing revision request:
```typescript
export interface ReviewRevisionRequest {
  fromRound: number;
  issueIds: string[];
  revisionPoints: RevisionPoint[];
  targetClaimMapId: string;
  antiPatternsToFix: AntiPatternFlag[];
}
```

Updated `ScientificReviewPacket` with `trackedIssues?` and `antiPatternFlags?`.
Updated `ScientificReviewResult` with `issueLedger?` and `acceptanceGated: boolean`.

### Full Rewrite of `scientific-reviewer.ts` (~750 lines)

Key new exports:
- `ALL_DIMENSIONS` — 13 dimensions (was 10)
- `ALL_ANTI_PATTERNS` — 10 anti-pattern types
- `PASS_RUBRIC` — pass criteria (min dimension score 3, min avg 3.5, zero critical blockers/anti-patterns, max 2 open major issues)
- `generateIssueId()`, `resetIssueCounter()` — sequential ISS-001 style IDs
- `blockerToIssue()` — convert ScientificBlocker to ReviewIssue
- `mergeIssueLedger()` — merge new blockers into existing ledger with title matching
- `finalizeIssueStatuses()` — mark unraised issues as resolved
- `checkAcceptanceGate()` — check if pass rubric is satisfied
- `buildRevisionRequest()` — generate point-by-point revision instructions for synthesizer
- `applyAcceptanceGate()` — downgrade unjustified "pass" verdicts

### Updated `synthesizer.ts`

Added:
- `buildRevisionPrompt()` — prompt for targeted ClaimMap revision
- `executeRevisionSynthesis()` — execute revision of existing ClaimMap based on reviewer feedback

### Updated `reviewer-deliberation.ts`

Implements the review → revision loop:
1. Run scientific review
2. If verdict is "revise", build `ReviewRevisionRequest`
3. Send to synthesizer for targeted revision
4. Re-review the revised ClaimMap
5. Repeat up to `maxRounds` iterations
6. Log acceptance-gating status

### Tests Rewritten (45 tests)

Full rewrite of `scientific-reviewer.test.ts`:
- Dimension coverage (13 dimensions, labels)
- Anti-pattern detection (10 types, prompt inclusion)
- Issue tracking (ID generation, creation, matching, status transitions, history)
- Acceptance gating (6 rejection scenarios, 1 pass scenario, unjustified pass prevention)
- Anti-loop enforcement (round caps, forced terminal, blocker clearing)
- Convergence checking
- Revision request building (from packets, low-scoring dimensions, anti-patterns, deduplication)
- Pass rubric (threshold values, prompt inclusion)
- Prompt structure (issue ledger, dimensions, final round restrictions)
- Example fixture: full lifecycle (weak → critique → revision → pass)
- Example fixture: persistent rejection (3 rounds → forced reject)

---

## Phase 3: Full Execution Pipeline

### Goal

Implement a production-oriented execution layer so that research plans can become runnable experiments, with dataset acquisition, preprocessing, job submission, dry-run/mock modes, and manifest tracking.

### New Types Added to `types.ts` (~280 lines)

```typescript
// Core spec
ExperimentSpec, DataSourceSpec, PreprocessingPipelineSpec, PreprocessingStepSpec,
ExperimentCommand, ExperimentResources, EnvironmentSetup, OutputConfig, RetryPolicy

// Status enums
ExperimentScale = "pilot" | "full" | "preprocess_only" | "eval_only" | "data_only"
ExperimentStatus = "planning" | "data_pending" | ... | "completed" | "failed" | "dry_run"
SubmissionMode = "real" | "dry_run" | "mock"
JobStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled" | "unknown"

// Results
JobSubmissionResult, JobStatusResult, DatasetAcquisitionResult,
PreprocessingStepResult, PreprocessingRunResult

// Manifest
ExperimentManifest, DryRunResult

// Config
ExecutionPipelineConfig, DEFAULT_EXECUTION_PIPELINE_CONFIG
```

### New Modules Created (7 files)

#### `exec-config.ts` (~110 lines)
- `resolveConfig()` — merge overrides with defaults
- `resolveResources()` — per-experiment resource merging
- `resolveEnvironment()` — environment setup merging
- Path helpers: `datasetCachePath()`, `experimentOutputPath()`, `preprocessingOutputPath()`

#### `exec-job-submitter.ts` (~350 lines)
- `SubmissionAdapter` interface: `renderSpec()`, `submit()`, `queryStatus()`, `cancel()`
- `MockSubmissionAdapter` — configurable (latency, failure), tracks job lifecycle (queued → running → completed)
- `RJobSubmissionAdapter` — real cluster submission via `rjob submit`
- Spec converters: `specToRJobManifest()`, `specToRLaunchManifest()`, `specToSlurmManifest()`
- `renderJobSpec()` — human-readable experiment overview
- Adapter registry: `registerSubmissionAdapter()`, `getSubmissionAdapter()`

#### `exec-dataset-manager.ts` (~230 lines)
- `buildDownloadCommand()` — generates download command per source type (HF, GitHub, URL, local)
- `buildDatasetAcquisitionPlan()` — determines which sources need downloading vs skip
- `executeDatasetAcquisition()` — runs downloads with injectable executor
- `createDatasetManifest()` — creates dataset manifest from results
- Injectable: `setFileExistenceChecker()`, `setCommandExecutor()`

#### `exec-preprocess-runner.ts` (~300 lines)
- `hashStepConfig()`, `hashPipelineConfig()` — SHA-256 config hashing for cache invalidation
- `buildStepCommand()` — generates Python/bash commands for 8 step types:
  - `filter`, `transform`, `dedup`, `split`, `sample`, `tokenize`, `validate`, `custom`
- `executePreprocessingPipeline()` — sequential execution with per-step caching, stops on failure
- `generatePreprocessingManifest()` — reproducibility manifest
- Injectable: `setFileChecker()`, `setCommandRunner()`, `setHashReader()`

#### `exec-manifest.ts` (~170 lines)
- `createExperimentManifest()` — initial manifest from spec
- `updateManifestWithDatasets()` — update after data acquisition
- `updateManifestWithPreprocessing()` — update after preprocessing
- `updateManifestWithSubmission()` — update after job submission
- `finalizeManifest()` — mark complete with evaluation summary
- `renderManifestSummary()` — human-readable text

#### `exec-readiness.ts` (~220 lines)
- `checkExecutionReadiness()` — validates spec, returns blockers/warnings
- `generateDryRun()` — renders what would happen without executing
- `estimateGPUHours()` — estimates based on dataset size and task type
- `suggestResources()` — suggests GPU/memory based on model size
- `toPilotSpec()` — create pilot-scale version (max 2 GPU, 4h walltime, --max_steps=100)
- `toFullSpec()` — convert pilot to full-scale

#### `exec-pipeline.ts` (~250 lines)
- `buildExperimentSpec()` — converts ValidationPlan + session → ExperimentSpec
- `executePipeline()` — main orchestrator: readiness → dry-run → data → preprocess → submit
- `generateExecutionSpec()` — convenience for dry-run generation
- `previewDataAcquisition()` — preview dataset fetch plan
- `inspectJobSpec()` — render spec without submitting

### Tests Created (65 tests in `execution-pipeline.test.ts`)

| Category | Tests | What's Covered |
|----------|-------|----------------|
| exec-config | 5 | Default resolution, overrides, resources, environment, paths |
| exec-job-submitter | 8 | rjob/rlaunch/slurm manifests, mock submit/status/cancel, dry-run, failure config |
| exec-dataset-manager | 7 | HF/GitHub/local commands, acquisition plan, skip-if-exists, mock execution, failure |
| exec-preprocess-runner | 8 | Config hashing, step commands, pipeline execution, skip caching, failure stops, manifest, disabled |
| exec-manifest | 6 | Create/update lifecycle, dataset/preprocessing/submission updates, finalize, render |
| exec-readiness | 10 | Valid spec, blockers, warnings, dry-run, GPU estimation, resource suggestion, pilot/full |
| exec-pipeline | 8 | Spec building, full mock pipeline, dry-run mode, failures at each stage, log entries |
| Main Brain routing | 4 | Readiness, blocker detection, scale classification, command summary |

### Documentation

#### `EXECUTION.md`
- Architecture overview with data flow diagram
- How research plan becomes executable plan
- Dataset acquisition: supported sources, cache behavior, test overrides
- Preprocessing pipeline: step types, config, cache invalidation
- rjob spec building: adapters, mock vs real
- Dry-run vs mock vs real comparison table
- End-to-end example with dataset, preprocessing config, execution plan, rjob spec, expected outputs
- Test coverage summary

---

## Complete File Inventory

### New Files (16 total)

| File | Phase | Lines |
|------|-------|-------|
| `src/lib/deep-research/scientific-reviewer.ts` | 1+2 | ~750 |
| `src/lib/deep-research/slurm-launcher.ts` | 1 | ~185 |
| `src/lib/deep-research/execution-planner.ts` | 1 | ~340 |
| `src/lib/deep-research/data-acquisition.ts` | 1 | ~260 |
| `src/lib/deep-research/state-tracker.ts` | 1 | ~400 |
| `src/lib/deep-research/preprocessing.ts` | 1 | ~310 |
| `src/lib/deep-research/exec-pipeline.ts` | 3 | ~250 |
| `src/lib/deep-research/exec-config.ts` | 3 | ~110 |
| `src/lib/deep-research/exec-job-submitter.ts` | 3 | ~350 |
| `src/lib/deep-research/exec-dataset-manager.ts` | 3 | ~230 |
| `src/lib/deep-research/exec-preprocess-runner.ts` | 3 | ~300 |
| `src/lib/deep-research/exec-manifest.ts` | 3 | ~170 |
| `src/lib/deep-research/exec-readiness.ts` | 3 | ~220 |
| `src/lib/deep-research/__tests__/execution-pipeline.test.ts` | 3 | ~920 |
| `src/lib/deep-research/ARCHITECTURE.md` | 1 | ~200 |
| `src/lib/deep-research/EXECUTION.md` | 3 | ~250 |

### Modified Files (8 total)

| File | Phase | Changes |
|------|-------|---------|
| `src/lib/deep-research/types.ts` | 1+2+3 | +~600 lines: all new type definitions |
| `src/lib/deep-research/phases/literature-synthesis.ts` | 1 | Rewritten for synthesizer pipeline |
| `src/lib/deep-research/phases/reviewer-deliberation.ts` | 1+2 | Scientific review + revision loop |
| `src/lib/deep-research/phases/planning.ts` | 1 | Dynamic skill routing |
| `src/lib/deep-research/model-router.ts` | 1 | Added synthesizer role |
| `src/lib/deep-research/execution-adapters.ts` | 1 | Added slurm case |
| `src/lib/deep-research/synthesizer.ts` | 2 | Added revision synthesis |
| `src/lib/deep-research/__tests__/scientific-reviewer.test.ts` | 1+2 | Rewritten: 17 → 45 tests |

### Test Files (4 total, 150 tests)

| File | Tests |
|------|-------|
| `scientific-reviewer.test.ts` | 45 |
| `execution-pipeline.test.ts` | 65 |
| `synthesis-and-routing.test.ts` | 22 |
| `execution-plane.test.ts` | 18 |

---

## Key Design Decisions

### 1. Backward Compatibility
- Scientific review is opt-in via `config.scientificReview`
- Skill routing is opt-in via `config.skillRouting.enabled`
- Literature synthesis falls back to main_brain if synthesizer fails
- Reviewer deliberation falls back to classic battle if scientific review fails

### 2. Testability
- All external dependencies are injectable (file system, command executor, submission adapter)
- `MockSubmissionAdapter` simulates full job lifecycle without cluster
- `setCommandExecutor()` / `setCommandRunner()` / `setFileExistenceChecker()` for test isolation
- 150 tests run in <1 second with zero external dependencies

### 3. Reproducibility
- `ExperimentManifest` tracks exact dataset versions, preprocessing config, code version, execution config
- Config hashing for preprocessing cache invalidation
- Every stage produces artifacts stored in the event store

### 4. Separation of Concerns
- Spec generation is pure (no side effects)
- Submission logic is behind `SubmissionAdapter` interface
- Data acquisition separates planning from execution
- Preprocessing separates command building from running

### 5. Three Submission Modes
- `dry_run` — renders plan without any execution
- `mock` — full pipeline with mock backends
- `real` — production execution against real cluster

---

## Remaining Limitations and Next Steps

### Not Yet Implemented
- **Real file-locking** for concurrent downloads
- **Checksum verification** after downloads (interface exists, not enforced)
- **Experiment resume** from mid-pipeline failure (manifest tracks state but no auto-resume)
- **Metrics summary parser** for common training frameworks
- **SSH launcher adapter** (type exists, no implementation)
- **Real-time job monitoring** (adapter can query status, no polling loop)
- **Artifact collection** from completed jobs
- **Multi-node training** support in rjob adapter

### Cluster-Specific Configuration Needed
- Docker image URLs in rjob adapter
- GPFS mount paths
- Charged group / billing
- Module names for `module load`
- Conda environment names

### Architecture Improvements
- Pipeline should be interruptible/resumable at each stage
- Support for DAG-based preprocessing (currently sequential)
- Support for multi-experiment campaigns
- Integration with experiment tracking systems (W&B, MLflow)
