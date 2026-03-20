// =============================================================
// Deep Research — Execution Planner
// =============================================================
// Converts a ValidationPlan + ClaimMap into a structured ExecutionPlanFull
// with stages for data acquisition, preprocessing, training, monitoring,
// and artifact collection.

import { generateText } from "ai";
import { getModelForRole, checkBudget, trackUsage } from "./model-router";
import * as store from "./event-store";
import type {
  DeepResearchSession,
  DeepResearchArtifact,
  ArtifactProvenance,
  ExecutionPlanFull,
  ExecutionStage,
  DataRequirement,
  ValidationPlan,
  ClaimMap,
  NodeCreationSpec,
  NodeType,
  WorkerFanoutPlan,
  WorkerDecompositionStrategy,
  ValidationCriteria,
  AggregationRules,
  RetryPolicy,
  LauncherType,
  ExperimentSpec,
  ExperimentResources,
  ExperimentCommand,
  DataSourceSpec,
  PreprocessingPipelineSpec,
  OutputConfig,
  EnvironmentSetup,
} from "./types";

// -------------------------------------------------------------------
// Prompt builder
// -------------------------------------------------------------------

/**
 * Build a prompt for the LLM to generate a structured ExecutionPlanFull.
 */
export function buildExecutionPlanPrompt(
  session: DeepResearchSession,
  validationPlan: ValidationPlan,
  claimMap?: ClaimMap | null,
  synthesisArtifacts?: DeepResearchArtifact[],
): string {
  const claimSection = claimMap
    ? `\n## Claim Map Summary\n- ${claimMap.claims.length} claims (${claimMap.claims.filter(c => c.strength === "strong").length} strong)\n- ${claimMap.contradictions.length} contradictions\n- ${claimMap.gaps.length} gaps\n\nKey claims:\n${claimMap.claims.slice(0, 10).map(c => `- [${c.strength}] ${c.text}`).join("\n")}`
    : "";

  const synthSection = synthesisArtifacts && synthesisArtifacts.length > 0
    ? `\n## Synthesis Artifacts\n${synthesisArtifacts.map(a => `- ${a.title}: ${JSON.stringify(a.content).slice(0, 500)}`).join("\n")}`
    : "";

  return `Convert the following validation plan into a detailed, multi-stage execution plan.

## Research Goal
${session.title}

## Validation Plan
${JSON.stringify(validationPlan, null, 2)}
${claimSection}
${synthSection}

## Instructions
Create a structured execution plan with the following stage types:
1. **data_download**: Acquire datasets (HuggingFace, GitHub, URLs)
2. **preprocess**: Clean, normalize, split, dedup data
3. **execute**: Run training/evaluation experiments
4. **monitor**: Track running jobs
5. **result_collect**: Gather outputs, metrics, artifacts

For each stage, specify:
- Dependencies (which prior stages must complete first)
- Data requirements (name, source URL/ID, format, estimated size)
- Shell commands to execute
- Expected outputs

## Resource Context
- Default GPU: ${session.config.execution.defaultResources.gpu}
- Default Memory: ${session.config.execution.defaultResources.memoryMb}MB
- Default CPU: ${session.config.execution.defaultResources.cpu}
- Launcher: ${session.config.execution.defaultLauncherType}
- Mounts: ${session.config.execution.defaultMounts.map(m => `${m.source}:${m.target}`).join(", ")}

## Output Format
Respond with valid JSON:
{
  "stages": [
    {
      "stageNumber": 1,
      "name": "Download dataset",
      "description": "Download X dataset from HuggingFace",
      "nodeType": "data_download",
      "dependencies": [],
      "estimatedGPUHours": 0,
      "dataRequirements": [
        { "name": "dataset_name", "source": "huggingface://org/dataset", "format": "jsonl", "estimatedSizeGb": 5.0, "cachePath": "/mnt/data/dataset" }
      ],
      "commands": ["huggingface-cli download org/dataset --local-dir /mnt/data/dataset"],
      "expectedOutputs": ["/mnt/data/dataset/train.jsonl"]
    }
  ],
  "totalEstimatedGPUHours": 48,
  "dataRequirements": [...all unique data requirements...],
  "prerequisites": ["Python 3.10+", "CUDA 12.x", "PyTorch 2.x"]
}

Be specific and executable. Every command should be runnable.`;
}

// -------------------------------------------------------------------
// Generate execution plan via LLM
// -------------------------------------------------------------------

/**
 * Generate a structured ExecutionPlanFull by calling the LLM.
 */
export async function generateExecutionPlan(
  session: DeepResearchSession,
  validationPlan: ValidationPlan,
  claimMap?: ClaimMap | null,
  synthesisArtifacts?: DeepResearchArtifact[],
  abortSignal?: AbortSignal,
): Promise<ExecutionPlanFull> {
  const { model } = getModelForRole("main_brain", session.config);
  const budgetCheck = checkBudget("main_brain", session.budget, session.config.budget);

  if (!budgetCheck.allowed) {
    throw new Error(`Execution planner budget exceeded: ${budgetCheck.reason}`);
  }

  // Create planner node
  const plannerNode = await store.createNode(session.id, {
    nodeType: "validation_plan",
    label: "Generate execution plan",
    assignedRole: "main_brain",
    input: {
      validationPlan,
      hasClaimMap: !!claimMap,
      hasSynthesis: !!(synthesisArtifacts && synthesisArtifacts.length > 0),
    },
    phase: "validation_planning",
  });

  await store.updateNode(plannerNode.id, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    const prompt = buildExecutionPlanPrompt(session, validationPlan, claimMap, synthesisArtifacts);

    const result = await generateText({
      model,
      system: "You are an ML execution planner. Convert a validation plan into a concrete, multi-stage execution plan. Respond ONLY with valid JSON.",
      messages: [{ role: "user", content: prompt }],
      abortSignal,
    });

    const tokens = result.usage?.totalTokens ?? 0;
    const budget = trackUsage(session.budget, "main_brain", plannerNode.id, tokens);
    await store.updateSession(session.id, { budget });

    const plan = parseExecutionPlan(result.text);

    // Validate
    const validation = validateExecutionPlan(plan);
    if (!validation.valid) {
      console.warn("[execution-planner] Plan validation warnings:", validation.errors);
    }

    // Mark node completed
    await store.updateNode(plannerNode.id, {
      status: "completed",
      output: plan as unknown as Record<string, unknown>,
      completedAt: new Date().toISOString(),
    });

    // Save artifact
    const provenance: ArtifactProvenance = {
      sourceNodeId: plannerNode.id,
      sourceArtifactIds: [],
      model: "main_brain",
      generatedAt: new Date().toISOString(),
    };

    await store.createArtifact(
      session.id,
      plannerNode.id,
      "execution_plan",
      `Execution Plan (${plan.stages.length} stages, ~${plan.totalEstimatedGPUHours} GPU-hours)`,
      plan as unknown as Record<string, unknown>,
      provenance,
    );

    await store.appendEvent(session.id, "execution_plan_created", plannerNode.id, "main_brain", undefined, undefined, {
      stageCount: plan.stages.length,
      totalGPUHours: plan.totalEstimatedGPUHours,
      dataRequirements: plan.dataRequirements.length,
    });

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution plan generation failed";
    await store.updateNode(plannerNode.id, {
      status: "failed",
      error: message,
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------

/**
 * Validate an ExecutionPlanFull for completeness and correctness.
 */
export function validateExecutionPlan(plan: ExecutionPlanFull): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!plan.stages || plan.stages.length === 0) {
    errors.push("Execution plan has no stages");
    return { valid: false, errors };
  }

  const stageNumbers = new Set(plan.stages.map(s => s.stageNumber));

  for (const stage of plan.stages) {
    // Check commands
    if (!stage.commands || stage.commands.length === 0) {
      errors.push(`Stage ${stage.stageNumber} (${stage.name}) has no commands`);
    }

    // Check dependencies reference valid stages
    for (const dep of stage.dependencies) {
      if (!stageNumbers.has(dep)) {
        errors.push(`Stage ${stage.stageNumber} depends on non-existent stage ${dep}`);
      }
      if (dep >= stage.stageNumber) {
        errors.push(`Stage ${stage.stageNumber} has forward dependency on stage ${dep}`);
      }
    }

    // Check data requirements have sources
    for (const req of stage.dataRequirements) {
      if (!req.source) {
        errors.push(`Stage ${stage.stageNumber}: data requirement "${req.name}" has no source`);
      }
    }
  }

  // Check for circular dependencies
  const visited = new Set<number>();
  const visiting = new Set<number>();

  function hasCycle(stageNum: number): boolean {
    if (visiting.has(stageNum)) return true;
    if (visited.has(stageNum)) return false;

    visiting.add(stageNum);
    const stage = plan.stages.find(s => s.stageNumber === stageNum);
    if (stage) {
      for (const dep of stage.dependencies) {
        if (hasCycle(dep)) return true;
      }
    }
    visiting.delete(stageNum);
    visited.add(stageNum);
    return false;
  }

  for (const stage of plan.stages) {
    visited.clear();
    visiting.clear();
    if (hasCycle(stage.stageNumber)) {
      errors.push(`Circular dependency detected involving stage ${stage.stageNumber}`);
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

// -------------------------------------------------------------------
// Convert plan to node specs
// -------------------------------------------------------------------

/**
 * Convert an ExecutionPlanFull into NodeCreationSpec[] for orchestrator dispatch.
 */
export function executionPlanToNodeSpecs(
  plan: ExecutionPlanFull,
  _session: DeepResearchSession,
): NodeCreationSpec[] {
  const specs: NodeCreationSpec[] = [];

  // Map stage numbers to node IDs (will be filled after creation)
  const stageToPhase: Record<string, "resource_acquisition" | "experiment_execution"> = {
    data_download: "resource_acquisition",
    preprocess: "resource_acquisition",
    execute: "experiment_execution",
    monitor: "experiment_execution",
    result_collect: "experiment_execution",
  };

  for (const stage of plan.stages) {
    const nodeType = mapStageNodeType(stage.nodeType);
    const phase = stageToPhase[stage.nodeType] ?? "experiment_execution";

    specs.push({
      nodeType,
      label: `Stage ${stage.stageNumber}: ${stage.name}`,
      assignedRole: "worker",
      input: {
        stageNumber: stage.stageNumber,
        description: stage.description,
        commands: stage.commands,
        expectedOutputs: stage.expectedOutputs,
        dataRequirements: stage.dataRequirements,
        estimatedGPUHours: stage.estimatedGPUHours,
      },
      phase,
    });
  }

  return specs;
}

function mapStageNodeType(stageNodeType: NodeType): NodeType {
  const valid: NodeType[] = [
    "data_download", "preprocess", "execute", "monitor", "result_collect",
    "resource_request", "evidence_gather",
  ];
  if (valid.includes(stageNodeType)) return stageNodeType;
  return "execute";
}

// -------------------------------------------------------------------
// Parsing
// -------------------------------------------------------------------

function parseExecutionPlan(text: string): ExecutionPlanFull {
  const parsed = extractJsonFromText(text);

  if (!parsed) {
    return { stages: [], totalEstimatedGPUHours: 0, dataRequirements: [], prerequisites: [] };
  }

  const stages: ExecutionStage[] = [];
  if (Array.isArray(parsed.stages)) {
    for (const s of parsed.stages) {
      if (s && typeof s === "object") {
        stages.push({
          stageNumber: typeof s.stageNumber === "number" ? s.stageNumber : stages.length + 1,
          name: String(s.name ?? `Stage ${stages.length + 1}`),
          description: String(s.description ?? ""),
          nodeType: (s.nodeType as NodeType) ?? "execute",
          dependencies: Array.isArray(s.dependencies) ? s.dependencies : [],
          estimatedGPUHours: typeof s.estimatedGPUHours === "number" ? s.estimatedGPUHours : 0,
          dataRequirements: Array.isArray(s.dataRequirements) ? s.dataRequirements.map(parseDataReq) : [],
          commands: Array.isArray(s.commands) ? s.commands.map(String) : [],
          expectedOutputs: Array.isArray(s.expectedOutputs) ? s.expectedOutputs.map(String) : [],
        });
      }
    }
  }

  return {
    stages,
    totalEstimatedGPUHours: typeof parsed.totalEstimatedGPUHours === "number" ? parsed.totalEstimatedGPUHours : stages.reduce((s, st) => s + st.estimatedGPUHours, 0),
    dataRequirements: Array.isArray(parsed.dataRequirements) ? parsed.dataRequirements.map(parseDataReq) : [],
    prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites.map(String) : [],
  };
}

function parseDataReq(raw: unknown): DataRequirement {
  if (!raw || typeof raw !== "object") {
    return { name: "unknown", source: "", format: "jsonl", estimatedSizeGb: 0 };
  }
  const r = raw as Record<string, unknown>;
  return {
    name: String(r.name ?? "unknown"),
    source: String(r.source ?? ""),
    format: String(r.format ?? "jsonl"),
    estimatedSizeGb: typeof r.estimatedSizeGb === "number" ? r.estimatedSizeGb : 0,
    cachePath: r.cachePath ? String(r.cachePath) : undefined,
  };
}

function extractJsonFromText(text: string): Record<string, unknown> | null {
  try {
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) return JSON.parse(fenceMatch[1].trim());

    const firstBrace = text.indexOf("{");
    if (firstBrace >= 0) {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = firstBrace; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        if (ch === "}") {
          depth--;
          if (depth === 0) return JSON.parse(text.slice(firstBrace, i + 1));
        }
      }
    }
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

// -------------------------------------------------------------------
// Worker Fanout Planning
// -------------------------------------------------------------------

/**
 * Decide the best decomposition strategy for a given validation plan.
 */
export function inferDecompositionStrategy(
  validationPlan: ValidationPlan,
): WorkerDecompositionStrategy {
  const text = JSON.stringify(validationPlan).toLowerCase();

  if (text.includes("ablation")) return "ablation";
  if (text.includes("hyperparameter") || text.includes("hyper-parameter") || text.includes("grid search") || text.includes("sweep")) {
    return "hyperparameter_sweep";
  }
  if (text.includes("seed") || text.includes("replicate") || text.includes("variance")) {
    return "seed_sweep";
  }
  if (text.includes("benchmark") || text.includes("shard")) return "benchmark_shard";
  if (text.includes("model variant") || text.includes("model comparison")) return "model_variant";
  if (text.includes("preprocess")) return "preprocessing_shard";
  if (text.includes("train") && text.includes("eval")) return "train_eval_split";
  return "seed_sweep";
}

/**
 * Build a WorkerFanoutPlan from an ExecutionPlanFull.
 *
 * Converts a high-level plan into a concrete worker decomposition
 * with parameter spaces, validation criteria, aggregation rules,
 * and resource estimates.
 */
export function buildWorkerFanoutPlan(
  plan: ExecutionPlanFull,
  session: DeepResearchSession,
  opts?: {
    strategy?: WorkerDecompositionStrategy;
    seeds?: number[];
    parameterSpace?: Array<{ name: string; values: unknown[] }>;
    validationCriteria?: Partial<ValidationCriteria>;
    launcherOverride?: LauncherType;
    maxParallel?: number;
    pilotFirst?: boolean;
  },
): WorkerFanoutPlan {
  const strategy = opts?.strategy ?? "seed_sweep";

  // Build parameter space
  const parameterSpace: Array<{ name: string; values: unknown[] }> = opts?.parameterSpace ?? [];
  if (strategy === "seed_sweep" && !parameterSpace.find(p => p.name === "seed")) {
    parameterSpace.push({ name: "seed", values: opts?.seeds ?? [42, 123, 456] });
  }

  // Calculate total workers from parameter space
  const totalWorkers = parameterSpace.length > 0
    ? parameterSpace.reduce((acc, p) => acc * p.values.length, 1)
    : 1;

  // Build base experiment spec from the execute stages
  const parentSpec = buildBaseExperimentSpec(plan, session, opts?.launcherOverride);

  // Build per-worker resources (same as parent by default)
  const perWorkerResources: ExperimentResources = { ...parentSpec.resources };

  // Estimate total GPU hours
  const perWorkerHours = plan.totalEstimatedGPUHours / Math.max(plan.stages.filter(s => s.nodeType === "execute").length, 1);
  const estimatedTotalGPUHours = perWorkerHours * totalWorkers;

  return {
    parentSpec,
    strategy,
    parameterSpace,
    totalWorkers,
    maxParallel: opts?.maxParallel ?? 4,
    pilotFirst: opts?.pilotFirst ?? (estimatedTotalGPUHours > 10),
    dependencyType: "independent",
    validationCriteria: buildValidationCriteria(strategy, opts?.validationCriteria),
    aggregationRules: buildAggregationRules(strategy),
    estimatedTotalGPUHours,
    perWorkerResources,
  };
}

/**
 * Build a base ExperimentSpec from execution plan stages.
 */
function buildBaseExperimentSpec(
  plan: ExecutionPlanFull,
  session: DeepResearchSession,
  launcherOverride?: LauncherType,
): ExperimentSpec {
  const execConfig = session.config.execution;
  const res = execConfig.defaultResources;
  const now = new Date().toISOString();

  const commands: ExperimentCommand[] = [];
  for (const stage of plan.stages) {
    const cmdStage = stage.nodeType === "data_download" ? "setup"
      : stage.nodeType === "preprocess" ? "setup"
      : stage.nodeType === "execute" ? "train"
      : stage.nodeType === "result_collect" ? "eval"
      : "setup";

    for (const cmd of stage.commands) {
      const parts = cmd.split(/\s+/);
      commands.push({
        name: stage.name,
        stage: cmdStage as "setup" | "train" | "eval" | "postprocess",
        command: parts[0],
        args: parts.slice(1),
        dependsOn: stage.dependencies.map(d => {
          const depStage = plan.stages.find(s => s.stageNumber === d);
          return depStage?.name ?? `stage-${d}`;
        }),
      });
    }
  }

  const dataSources: DataSourceSpec[] = plan.dataRequirements.map((req, i) => ({
    id: `ds-${i}`,
    name: req.name,
    source: (req.source.includes("://") ? req.source.split("://")[0] : "url") as "huggingface" | "github" | "url" | "local",
    identifier: req.source.includes("://") ? req.source.split("://").slice(1).join("://") : req.source,
    format: req.format,
    estimatedSizeGb: req.estimatedSizeGb,
    cachePath: req.cachePath ?? `/mnt/data/${req.name}`,
  }));

  const resources: ExperimentResources = {
    gpu: res.gpu,
    cpu: res.cpu,
    memoryMb: res.memoryMb,
    walltime: res.maxWaitDuration ?? "24h",
    privateMachine: res.privateMachine,
  };

  const environment: EnvironmentSetup = {
    modules: [],
    condaEnv: undefined,
    venvPath: undefined,
    setupCommands: [],
    workingDir: "/workspace",
    envVars: {},
  };

  const outputs: OutputConfig = {
    baseDir: "/output",
    checkpointDir: "/output/checkpoints",
    logDir: "/output/logs",
    metricsDir: "/output/metrics",
    artifactPatterns: ["*.json", "*.pt", "*.bin"],
  };

  const preprocessing: PreprocessingPipelineSpec = {
    enabled: plan.stages.some(s => s.nodeType === "preprocess"),
    steps: [],
    outputPath: "/mnt/data/processed",
    outputFormat: "jsonl",
    skipIfCached: true,
  };

  const retryPolicy: RetryPolicy = {
    maxRetries: 2,
    retryOnOOM: true,
    retryDelaySeconds: 60,
    scaleDownOnOOM: true,
  };

  return {
    experimentId: `spec-${Date.now()}`,
    sessionId: session.id,
    name: session.title.slice(0, 64),
    description: `Execution plan: ${plan.stages.length} stages, ~${plan.totalEstimatedGPUHours} GPU-hours`,
    scale: plan.totalEstimatedGPUHours <= 2 ? "pilot" : "full",
    status: "planning",
    taskType: "research",
    models: [],
    launcherType: launcherOverride ?? execConfig.defaultLauncherType,
    submissionMode: "dry_run",
    resources,
    dataSources,
    preprocessing,
    commands,
    environment,
    mounts: execConfig.defaultMounts,
    outputs,
    retryPolicy,
    createdAt: now,
    updatedAt: now,
  };
}

// -------------------------------------------------------------------
// Validation Criteria Builder
// -------------------------------------------------------------------

/**
 * Build ValidationCriteria with sensible defaults for a given strategy.
 */
export function buildValidationCriteria(
  strategy: WorkerDecompositionStrategy,
  overrides?: Partial<ValidationCriteria>,
): ValidationCriteria {
  const base: ValidationCriteria = {
    metricThresholds: [],
    requiredArtifacts: ["metrics.json"],
    minSuccessfulWorkers: 1,
    maxVariance: strategy === "seed_sweep" ? 0.3 : null,
    baselineRequired: false,
    baselineMetrics: {},
    customConditions: [],
  };

  // Strategy-specific defaults
  switch (strategy) {
    case "seed_sweep":
      base.minSuccessfulWorkers = 2;
      base.maxVariance = 0.3;
      break;
    case "hyperparameter_sweep":
      base.minSuccessfulWorkers = 1; // at least one config must work
      break;
    case "ablation":
      base.minSuccessfulWorkers = 2;
      base.requiredArtifacts.push("ablation_results.json");
      break;
    case "benchmark_shard":
      base.minSuccessfulWorkers = 1;
      break;
    case "model_variant":
      base.minSuccessfulWorkers = 2;
      base.baselineRequired = true;
      break;
  }

  // Apply overrides
  if (overrides) {
    if (overrides.metricThresholds) base.metricThresholds = overrides.metricThresholds;
    if (overrides.requiredArtifacts) base.requiredArtifacts = overrides.requiredArtifacts;
    if (overrides.minSuccessfulWorkers !== undefined) base.minSuccessfulWorkers = overrides.minSuccessfulWorkers;
    if (overrides.maxVariance !== undefined) base.maxVariance = overrides.maxVariance;
    if (overrides.baselineRequired !== undefined) base.baselineRequired = overrides.baselineRequired;
    if (overrides.baselineMetrics) base.baselineMetrics = overrides.baselineMetrics;
    if (overrides.customConditions) base.customConditions = overrides.customConditions;
  }

  return base;
}

// -------------------------------------------------------------------
// Aggregation Rules Builder
// -------------------------------------------------------------------

/**
 * Build AggregationRules appropriate for a given decomposition strategy.
 */
export function buildAggregationRules(
  strategy: WorkerDecompositionStrategy,
): AggregationRules {
  const base: AggregationRules = {
    metricAggregation: "mean",
    minSuccessRate: 0.8,
    metricsToAggregate: ["accuracy", "loss", "f1"],
    computeVariance: false,
    maxCoefficientOfVariation: null,
    customAggregator: null,
  };

  switch (strategy) {
    case "seed_sweep":
      base.metricAggregation = "mean";
      base.computeVariance = true;
      base.maxCoefficientOfVariation = 0.3;
      base.minSuccessRate = 0.67;
      break;
    case "hyperparameter_sweep":
      base.metricAggregation = "max";
      base.minSuccessRate = 0.5;
      break;
    case "ablation":
      base.metricAggregation = "all";
      base.minSuccessRate = 0.9;
      break;
    case "benchmark_shard":
      base.metricAggregation = "mean";
      base.minSuccessRate = 0.8;
      break;
    case "model_variant":
      base.metricAggregation = "all";
      base.minSuccessRate = 1.0;
      break;
  }

  return base;
}

// -------------------------------------------------------------------
// Retry Policy Builder
// -------------------------------------------------------------------

/**
 * Build a RetryPolicy with sensible defaults.
 */
export function buildRetryPolicy(overrides?: Partial<RetryPolicy>): RetryPolicy {
  return {
    maxRetries: overrides?.maxRetries ?? 2,
    retryOnOOM: overrides?.retryOnOOM ?? true,
    retryDelaySeconds: overrides?.retryDelaySeconds ?? 60,
    scaleDownOnOOM: overrides?.scaleDownOnOOM ?? true,
  };
}

// -------------------------------------------------------------------
// Backend preference selection
// -------------------------------------------------------------------

/**
 * Select the best launcher type based on experiment requirements.
 */
export function selectLauncherType(
  resources: ExperimentResources,
  session: DeepResearchSession,
): LauncherType {
  const configLauncher = session.config.execution.defaultLauncherType;

  // If user has a preference, respect it
  if (configLauncher !== "rjob") return configLauncher;

  // Heuristic: use rlaunch for interactive / short experiments
  if (resources.gpu <= 1 && parseWalltime(resources.walltime) <= 2) {
    return "rlaunch";
  }

  // Large multi-GPU → rjob for proper scheduling
  if (resources.gpu >= 4) return "rjob";

  return configLauncher;
}

function parseWalltime(walltime: string): number {
  const match = walltime.match(/^(\d+)h/);
  return match ? parseInt(match[1], 10) : 24;
}

// -------------------------------------------------------------------
// Experiment DAG builder
// -------------------------------------------------------------------

/**
 * Build multiple WorkerFanoutPlans from a complex validation plan
 * that may require staged experiments (e.g., pilot → full run).
 */
export function buildExperimentDAG(
  plan: ExecutionPlanFull,
  session: DeepResearchSession,
  validationPlan: ValidationPlan,
): WorkerFanoutPlan[] {
  const strategy = inferDecompositionStrategy(validationPlan);
  const stages: WorkerFanoutPlan[] = [];

  // If plan has many GPU hours, split into pilot + full
  if (plan.totalEstimatedGPUHours > 10) {
    const pilotPlan = buildWorkerFanoutPlan(plan, session, {
      strategy: "seed_sweep",
      parameterSpace: [{ name: "seed", values: [42] }],
      pilotFirst: false,
      maxParallel: 1,
      validationCriteria: {
        minSuccessfulWorkers: 1,
        metricThresholds: [], // pilot just needs to complete
      },
    });
    pilotPlan.parentSpec.name = `[Pilot] ${pilotPlan.parentSpec.name}`;
    pilotPlan.parentSpec.scale = "pilot";
    stages.push(pilotPlan);
  }

  // Full run with the inferred strategy
  stages.push(buildWorkerFanoutPlan(plan, session, { strategy }));

  return stages;
}

// -------------------------------------------------------------------
// Prompt builder for worker fanout (LLM-assisted)
// -------------------------------------------------------------------

/**
 * Build a prompt for the LLM to generate worker fanout parameters.
 * Used when the parameter space is too complex to infer heuristically.
 */
export function buildWorkerFanoutPrompt(
  plan: ExecutionPlanFull,
  session: DeepResearchSession,
  validationPlan: ValidationPlan,
): string {
  return `Given the following execution plan and validation requirements, design a worker fanout plan.

## Research Goal
${session.title}

## Execution Plan Summary
- Stages: ${plan.stages.length}
- Total GPU-hours: ${plan.totalEstimatedGPUHours}
- Execute stages: ${plan.stages.filter(s => s.nodeType === "execute").map(s => s.name).join(", ")}

## Validation Plan
${JSON.stringify(validationPlan, null, 2)}

## Available Decomposition Strategies
- seed_sweep: Same config, multiple random seeds (for variance estimation)
- hyperparameter_sweep: Grid/random search over hyperparameters
- ablation: Remove one component at a time to measure impact
- benchmark_shard: Split benchmark across shards
- model_variant: Compare different model configurations
- replay_budget: Vary replay budget for RL
- preprocessing_shard: Shard preprocessing
- train_eval_split: Separate train and eval workers
- custom: Custom decomposition

## Instructions
Choose the best strategy and specify:
1. **strategy**: One of the above
2. **parameterSpace**: Array of {name, values} (e.g., [{name: "seed", values: [42, 123, 456]}])
3. **dependencyType**: "independent", "sequential", or "staged_dag"
4. **maxParallel**: How many workers to run at once
5. **validationCriteria**: Metric thresholds, required artifacts, min successful workers
6. **aggregationRules**: How to combine results

Respond with valid JSON matching the WorkerFanoutPlan schema.`;
}
