# Deep Research Architecture — Refactored

## Overview

The deep research framework has been refactored from a flat "search → reviewer → repeat" pipeline into a layered multi-role system with clear separation of concerns.

## Architecture Layers

```
Layer 1: Orchestration
├── MainBrain / ProjectManager (orchestrator.ts)
├── Transition Resolver (transition-resolver.ts)
├── State Tracker (state-tracker.ts)
└── Skill Router (skill-library.ts + planning phase)

Layer 2: Retrieval
├── Evidence Card Builder (evidence-cards.ts)
├── arXiv / Semantic Scholar / HuggingFace search tools
└── Skill-routed retrieval workers (arxiv_search, citation_backtrack, etc.)

Layer 3: Synthesis
├── Dedicated Synthesizer (synthesizer.ts)
├── ClaimMap builder (claims, contradictions, gaps)
└── Evidence honesty assessment

Layer 4: Review
├── Scientific Reviewer (scientific-reviewer.ts)  ← NEW
│   ├── 10-dimension scoring
│   ├── Structured blockers with repair paths
│   ├── Anti-loop logic (3-round max)
│   └── pass / revise / experimental_pivot / reject
├── Classic Reviewer Battle (reviewer-battle.ts)
└── Review configuration (scientific vs. classic)

Layer 5: Execution
├── Execution Planner (execution-planner.ts)      ← NEW
├── Data Acquisition (data-acquisition.ts)         ← NEW
│   ├── HuggingFace Hub / datasets
│   ├── GitHub repos / releases
│   └── Arbitrary URL downloads
├── Preprocessing Pipeline (preprocessing.ts)      ← NEW
├── Launcher Adapters (execution-adapters.ts)
│   ├── rjob launcher
│   ├── rlaunch launcher
│   └── Slurm launcher (slurm-launcher.ts)         ← NEW
├── Run Monitor (node-executor.ts)
└── Artifact Collector
```

## Workflow

```
User Goal
  │
  ▼
MainBrain (intake)
  │
  ▼
Planning (with optional skill routing)
  │  ├── Classifies task type (literature-heavy, experiment, benchmark, etc.)
  │  ├── Selects skills from catalog dynamically
  │  └── Creates worker node specs
  │
  ▼
Retrieval Workers → Evidence Cards
  │  ├── One worker per sub-question
  │  ├── Bounded by maxPapersPerRound
  │  └── Produce structured EvidenceCard artifacts
  │
  ▼
Synthesizer → ClaimMap
  │  ├── Reads evidence cards ONLY (no retrieval)
  │  ├── Builds claim map with strength ratings
  │  ├── Distinguishes: retrieved_evidence / background / assumption / speculation
  │  └── Identifies contradictions and gaps
  │
  ▼
Scientific Reviewer → ScientificReviewPacket
  │  ├── Two reviewers score 10 dimensions (1-5)
  │  ├── Produce structured blockers with repair paths
  │  ├── Round 1: find all major blockers (max 5 critical)
  │  ├── Round 2: verify fixes, max 1 new critical blocker
  │  ├── Round 3: FORCED DECISION (pass/pivot/reject)
  │  └── Support "experimental_pivot" for tractable pilots
  │
  ▼
MainBrain Decision
  │  ├── pass → execution planning or final report
  │  ├── revise → back to retrieval or synthesis
  │  ├── experimental_pivot → validation planning
  │  └── reject → stop with explanation
  │
  ▼
Execution Planning (if needed)
  │  ├── Generate multi-stage ExecutionPlanFull
  │  ├── Data acquisition steps (HF, GitHub)
  │  ├── Preprocessing pipeline
  │  ├── Training/evaluation stages
  │  └── Monitoring and artifact collection
  │
  ▼
Resource Acquisition
  │  ├── rjob manifest (preferred)
  │  ├── Slurm sbatch script (fallback)
  │  └── rlaunch for dev machines
  │
  ▼
Experiment Execution → Results
  │
  ▼
Validation Review
  │
  ▼
Final Report
```

## Role Descriptions

| Role | Module | Responsibility |
|------|--------|---------------|
| **MainBrain** | orchestrator.ts | Sole decision-maker. Decomposes problems, dispatches workers, audits results. |
| **Synthesizer** | synthesizer.ts | Reads evidence cards, builds ClaimMap. Never does retrieval. |
| **Scientific Reviewer** | scientific-reviewer.ts | Dimension-based audit with structured blockers. Advisory only. |
| **Worker** | node-executor.ts | Scoped executor. One narrow task per worker. Cannot redefine plan. |
| **Execution Planner** | execution-planner.ts | Converts validation plans into multi-stage execution plans. |

## Review Loop — How It Works

### Scientific Review (New)

1. **Round 1**: Both reviewers score all 10 dimensions. Up to 5 critical blockers allowed. Each blocker must include: issue, severity, why it matters, evidence, repair action, pass condition.

2. **Round 2**: Focus on verifying round-1 fixes. Only 1 new critical blocker allowed. Re-score all dimensions — track improving/stable/declining trends.

3. **Round 3 (forced)**: Must choose pass / experimental_pivot / reject. No "revise" allowed. No new blockers.

**Convergence**: Early stop if both reviewers agree on verdict AND all dimension score diffs ≤ threshold.

**experimental_pivot**: When foundational literature remains unresolved but a tractable pilot experiment can test construct validity.

### Anti-Loop Guarantees

- Critical blockers capped per round (5 → 1 → 0)
- "revise" verdict forbidden in final round
- Dimension score trends tracked to detect oscillation
- Convergence check after each round

## Execution Planning — How It Works

1. **Environment Audit**: Detect cluster type, launcher availability, GPU/CPU/memory requirements.

2. **Run Specification**: LLM generates ExecutionPlanFull with stages:
   - data_download → preprocess → execute → monitor → result_collect

3. **Data Acquisition**: Generate commands for HuggingFace Hub, GitHub, or URL downloads.

4. **Preprocessing**: Generate Python pipeline commands for normalization, dedup, splitting, contamination filtering.

5. **Job Submission**: Generate launcher manifests:
   - rjob (preferred) — `execution-adapters.ts`
   - Slurm/sbatch (fallback) — `slurm-launcher.ts`
   - rlaunch (dev machines)

6. **Monitoring**: Track job status, stdout/stderr, metrics.

7. **Artifact Collection**: Gather metrics.json, checkpoints, eval outputs.

## Dynamic Skill Routing — How It Works

When `config.skillRouting.enabled = true`:

1. MainBrain receives the full skill catalog during planning
2. Classifies the task type (literature-heavy, benchmark, experiment, etc.)
3. Selects appropriate skills from 5 categories:
   - Retrieval: arxiv_search, citation_backtrack, benchmark_retrieval, repo_dataset_discovery, etc.
   - Synthesis: literature_synthesis, mechanism_synthesis, contradiction_resolution, etc.
   - Review: scientific_review, experimental_design_review, execution_readiness_review
   - Execution: cluster_planning, data_pipeline_planning, launcher_preparation, run_monitoring
   - Report: final_report, experiment_spec_writing, executive_summary
4. Creates node specs for each selected skill
5. Worker fan-out adapts to task type (more retrieval workers for literature tasks, more execution workers for experiment tasks)

## How to Add New Skills

1. Define the skill in `skill-library.ts`:
```typescript
defaultSkillRegistry.register(skill(
  "my_new_skill",           // unique ID
  "My New Skill",           // display name
  "Description of what it does",
  "retrieval",              // category
  "retrieve",               // nodeType
  "worker",                 // defaultRole
  2000,                     // estimated tokens
));
```

2. If the skill needs a new nodeType, add it to `NodeType` in `types.ts`.

3. If the skill needs special worker behavior, add a case in `prompts.ts:getWorkerOutputSchema()`.

## State Tracking

The `state-tracker.ts` module provides a unified `ProjectState` view:

- **EvidenceLedger**: What was retrieved, success rates, honesty issues
- **SynthesisState**: Claim map statistics, gap count
- **ReviewState**: Current verdict, blocker counts, dimension scores
- **ExecutionState**: Plan stages, GPU hours, active/completed jobs

Use `buildProjectState(sessionId)` to get a snapshot. Use `summarizeProjectState(state)` for human-readable output. Use `getPhaseReadiness(state, targetPhase)` to check transition prerequisites.

## Configuration

### Enable Scientific Review
```json
{
  "scientificReview": {
    "maxRounds": 3,
    "convergenceThreshold": 1,
    "minimumDimensionScore": 3,
    "earlyStopOnAllPassing": true
  }
}
```

### Enable Skill Routing
```json
{
  "skillRouting": { "enabled": true }
}
```

### Slurm Fallback
The Slurm launcher is automatically registered. To use it, set:
```json
{
  "execution": {
    "defaultLauncherType": "slurm"
  }
}
```

## Files Changed/Created

### New Files (6 modules + 3 test files)
- `scientific-reviewer.ts` — Dimension-based scientific review with anti-loop
- `slurm-launcher.ts` — Slurm/sbatch launcher adapter
- `execution-planner.ts` — Multi-stage execution plan generation
- `data-acquisition.ts` — HuggingFace/GitHub data download utilities
- `state-tracker.ts` — Consolidated project state tracking
- `preprocessing.ts` — Data preprocessing pipeline specification
- `__tests__/scientific-reviewer.test.ts` — 18 tests
- `__tests__/execution-plane.test.ts` — 19 tests
- `__tests__/synthesis-and-routing.test.ts` — 20 tests

### Modified Files (3 phase handlers)
- `phases/literature-synthesis.ts` — Wired to use dedicated Synthesizer + evidence cards
- `phases/reviewer-deliberation.ts` — Supports scientific review path + classic battle fallback
- `phases/planning.ts` — Added dynamic skill routing with catalog

### Types Updated
- `types.ts` — Added "slurm" to LauncherType union
