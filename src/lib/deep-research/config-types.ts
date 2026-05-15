import type { ModelRole } from "./status-types";

export interface BudgetLimits {
  maxTotalTokens: number;
  maxOpusTokens: number;
}

export interface BudgetUsage {
  totalTokens: number;
  opusTokens: number;
  byRole: Partial<Record<ModelRole, number>>;
  byNode: Record<string, number>;
}

export type LauncherType = "rlaunch" | "rjob" | "slurm" | "local_shell" | "ssh";

export interface MountSpec {
  source: string;
  target: string;
}

export interface ResourceProfile {
  gpu: number;
  memoryMb: number;
  cpu: number;
  privateMachine: "yes" | "no" | "group";
  maxWaitDuration?: string;
}

export interface LiteratureConfig {
  maxLiteratureRounds: number;
  maxPapersPerRound: number;
  maxTotalPapers: number;
  maxReviewerRequestedExpansionRounds: number;
  maxSearchRetries: number;
}


export interface PivotRefineConfig {
  /** Maximum number of REFINE iterations per research session. */
  maxRefineIterations: number;
  /** Maximum number of PIVOT (direction change) allowed per session. */
  maxPivotCount: number;
  /** Threshold for auto-triggering REFINE (0-1, based on review confidence). */
  autoRefineConfidenceThreshold: number;
  /** Whether to auto-version artifacts on pivot/refine. */
  autoVersionArtifacts: boolean;
}

export interface DebateConfig {
  /** Number of debate rounds for hypothesis generation. */
  maxDebateRounds: number;
  /** Roles participating in the debate. */
  enabledRoles: string[];
  /** Whether to require consensus or majority vote. */
  consensusMode: "majority" | "unanimous" | "moderator_arbitration";
}

export interface EvolutionConfig {
  /** Enable cross-session learning from past runs. */
  enabled: boolean;
  /** Time-decay half-life in days (lessons older than this are half-weighted). */
  timeDecayDays: number;
  /** Maximum lessons to inject per session as prompt overlay. */
  maxLessonsPerSession: number;
  /** Categories of lessons to track. */
  enabledCategories: string[];
  /** Path to the evolution store (relative to data dir). */
  storePath: string;
}

export interface SentinelConfig {
  /** Enable background quality monitoring. */
  enabled: boolean;
  /** Check for NaN/Inf in experiment results. */
  checkNumericSanity: boolean;
  /** Check paper-evidence consistency. */
  checkEvidenceConsistency: boolean;
  /** Check citation relevance (anti-fabrication). */
  checkCitationRelevance: boolean;
  /** Severity threshold for auto-pausing (0-1). */
  autoPauseSeverityThreshold: number;
}

export interface ClaimVerificationConfig {
  /** Enable claim verification against collected evidence. */
  enabled: boolean;
  /** Minimum source count required to verify a claim. */
  minSupportingSources: number;
  /** Auto-flag claims with no supporting evidence. */
  autoFlagUnsupported: boolean;
  /** Cross-reference mode: strict (requires exact match) or fuzzy (semantic match). */
  crossReferenceMode: "strict" | "fuzzy";
}

export interface ExperimentRepairConfig {
  /** Enable automatic experiment repair. */
  enabled: boolean;
  /** Maximum repair cycles per experiment. */
  maxRepairCycles: number;
  /** Quality threshold to exit repair loop (0-1). */
  qualityThreshold: number;
  /** Diagnose failures automatically. */
  autoDiagnose: boolean;
}

export interface HardwareDetectionConfig {
  /** Enable hardware auto-detection for execution context. */
  enabled: boolean;
  /** Whether to adapt code generation based on detected hardware. */
  adaptCodeGeneration: boolean;
  /** Minimum VRAM (MB) for "high" tier classification. */
  highVramThresholdMb: number;
}

export interface ExecutionConfig {
  defaultLauncherType: LauncherType;
  defaultResources: ResourceProfile;
  defaultMounts: MountSpec[];
  defaultChargedGroup: string;
}

export interface DeepResearchConfig {
  modelOverrides?: Partial<Record<ModelRole, { provider: string; modelId: string }>>;
  resolvedModel?: { provider: string; modelId: string };
  interfaceOnly?: boolean;
  budget: BudgetLimits;
  maxWorkerFanOut: number;
  maxReviewerRounds: number;
  maxExecutionLoops: number;
  maxWorkerConcurrency: number;
  literature: LiteratureConfig;
  execution: ExecutionConfig;
  skillRouting?: { enabled: boolean };
  /** PIVOT/REFINE autonomous decision loop configuration. */
  pivotRefine: PivotRefineConfig;
  /** Multi-agent debate configuration. */
  debate: DebateConfig;
  /** Cross-session evolution (self-learning) configuration. */
  evolution: EvolutionConfig;
  /** Sentinel watchdog quality monitoring. */
  sentinel: SentinelConfig;
  /** Claim verification / anti-fabrication configuration. */
  claimVerification: ClaimVerificationConfig;
  /** Experiment self-healing repair configuration. */
  experimentRepair: ExperimentRepairConfig;
  /** Hardware auto-detection configuration. */
  hardwareDetection: HardwareDetectionConfig;
}

export const DEFAULT_LITERATURE_CONFIG: LiteratureConfig = {
  maxLiteratureRounds: 3,
  maxPapersPerRound: 10,
  maxTotalPapers: 30,
  maxReviewerRequestedExpansionRounds: 1,
  maxSearchRetries: 2,
};

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  defaultLauncherType: "rjob",
  defaultResources: {
    gpu: 2,
    memoryMb: 200000,
    cpu: 32,
    privateMachine: "yes",
  },
  defaultMounts: [
    { source: "gpfs://gpfs1/suencheng", target: "/mnt/shared-storage-user/suencheng" },
    { source: "gpfs://gpfs1/ai4sreason", target: "/mnt/shared-storage-user/ai4sreason" },
  ],
  defaultChargedGroup: "ai4sdata_gpu",
};

export const DEFAULT_PIVOT_REFINE_CONFIG: PivotRefineConfig = {
  maxRefineIterations: 3,
  maxPivotCount: 2,
  autoRefineConfidenceThreshold: 0.6,
  autoVersionArtifacts: true,
};

export const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  maxDebateRounds: 3,
  enabledRoles: ["debate_moderator", "debate_skeptic", "debate_librarian"],
  consensusMode: "majority",
};

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  enabled: true,
  timeDecayDays: 30,
  maxLessonsPerSession: 5,
  enabledCategories: ["system", "experiment", "literature", "hypothesis", "writing", "review"],
  storePath: "evolution",
};

export const DEFAULT_SENTINEL_CONFIG: SentinelConfig = {
  enabled: true,
  checkNumericSanity: true,
  checkEvidenceConsistency: true,
  checkCitationRelevance: true,
  autoPauseSeverityThreshold: 0.8,
};

export const DEFAULT_CLAIM_VERIFICATION_CONFIG: ClaimVerificationConfig = {
  enabled: true,
  minSupportingSources: 1,
  autoFlagUnsupported: true,
  crossReferenceMode: "fuzzy",
};

export const DEFAULT_EXPERIMENT_REPAIR_CONFIG: ExperimentRepairConfig = {
  enabled: true,
  maxRepairCycles: 3,
  qualityThreshold: 0.7,
  autoDiagnose: true,
};

export const DEFAULT_HARDWARE_DETECTION_CONFIG: HardwareDetectionConfig = {
  enabled: true,
  adaptCodeGeneration: true,
  highVramThresholdMb: 8192,
};

export const DEFAULT_CONFIG: DeepResearchConfig = {
  interfaceOnly: false,
  budget: {
    maxTotalTokens: 2_000_000,
    maxOpusTokens: 500_000,
  },
  maxWorkerFanOut: 1,
  maxReviewerRounds: 2,
  maxExecutionLoops: 3,
  maxWorkerConcurrency: 1,
  literature: DEFAULT_LITERATURE_CONFIG,
  execution: DEFAULT_EXECUTION_CONFIG,
  pivotRefine: DEFAULT_PIVOT_REFINE_CONFIG,
  debate: DEFAULT_DEBATE_CONFIG,
  evolution: DEFAULT_EVOLUTION_CONFIG,
  sentinel: DEFAULT_SENTINEL_CONFIG,
  claimVerification: DEFAULT_CLAIM_VERIFICATION_CONFIG,
  experimentRepair: DEFAULT_EXPERIMENT_REPAIR_CONFIG,
  hardwareDetection: DEFAULT_HARDWARE_DETECTION_CONFIG,
};

export function createEmptyUsage(): BudgetUsage {
  return { totalTokens: 0, opusTokens: 0, byRole: {}, byNode: {} };
}
