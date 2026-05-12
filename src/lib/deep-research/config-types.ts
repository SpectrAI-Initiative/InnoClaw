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
};

export function createEmptyUsage(): BudgetUsage {
  return { totalTokens: 0, opusTokens: 0, byRole: {}, byNode: {} };
}
