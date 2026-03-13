// =============================================================
// Research Execution Workspace — Core Types
// =============================================================

/** Capability flags governing what the research execution system can do.
 *  All default to `false` — the user must explicitly opt in. */
export interface CapabilityFlags {
  canReadCodebase: boolean;
  canWriteCodebase: boolean;
  canUseLocalTerminal: boolean;
  canUseSSH: boolean;
  canSyncRemote: boolean;
  canSubmitJobs: boolean;
  canCollectRemoteResults: boolean;
  canAutoApplyChanges: boolean;
}

export const DEFAULT_CAPABILITIES: CapabilityFlags = {
  canReadCodebase: false,
  canWriteCodebase: false,
  canUseLocalTerminal: false,
  canUseSSH: false,
  canSyncRemote: false,
  canSubmitJobs: false,
  canCollectRemoteResults: false,
  canAutoApplyChanges: false,
};

export const CAPABILITY_KEYS = Object.keys(
  DEFAULT_CAPABILITIES,
) as (keyof CapabilityFlags)[];

// =============================================================
// Remote Execution Profile
// =============================================================

export type SchedulerType = "shell" | "slurm" | "rjob";

export interface RemoteExecutionProfile {
  id: string;
  workspaceId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  remotePath: string;
  schedulerType: SchedulerType;
  /** Path to the SSH private key file on the server machine (e.g. ~/.ssh/id_rsa).
   *  Never store the raw key content — only a file path reference. */
  sshKeyRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================
// Experiment Run
// =============================================================

export type ExperimentRunStatus =
  | "planning"
  | "patching"
  | "syncing"
  | "submitted"
  | "monitoring"
  | "running"
  | "collecting"
  | "analyzing"
  | "completed"
  | "failed"
  | "cancelled";

export interface RJobSubmissionSpec {
  image: string;
  gpuCount?: number;
  memory?: string;
  mounts?: string[];
  entrypoint: string;
  jobName?: string;
  extraArgs?: string[];
}

export interface ExperimentManifest {
  entrypoint: string;
  command: string;
  configOverrides?: Record<string, unknown>;
  expectedOutputs?: string[];
  rjobSpec?: RJobSubmissionSpec;
}

export interface ExperimentResultSummary {
  outcome: "success" | "failure" | "partial" | "unknown";
  keyMetrics?: Record<string, number | string>;
  logs?: string;
  observations?: string[];
  failureCause?: string;
}

export type RecommendationType =
  | "code_change"
  | "config_change"
  | "new_ablation"
  | "rerun"
  | "direction_change";

export interface AnalysisRecommendation {
  nextStep: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  type: RecommendationType;
  alternatives?: string[];
}

// =============================================================
// Job Monitoring
// =============================================================

export type RunMonitorStatus =
  | "queued"
  | "running"
  | "completing"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "stopped"
  | "needs_attention"
  | "unknown";

export interface RunStatusSnapshot {
  schedulerStatus: RunMonitorStatus;
  markerEvidence: "done" | "failed" | "none";
  heartbeat: { found: boolean; ageSeconds?: number } | null;
  logTail: string | null;
  logGrowing: boolean | null;
  resolvedStatus: RunMonitorStatus;
  decision: "still_running" | "completed" | "failed" | "needs_attention";
  retryAfterSeconds: number | null;
  timestamp: string;
  rawOutput?: string;
}

export interface JobMonitoringConfig {
  pollIntervalSeconds?: number;
  heartbeatPath?: string;
  doneMarkerPath?: string;
  failedMarkerPath?: string;
  logPaths?: string[];
}

export interface ExperimentRun {
  id: string;
  workspaceId: string;
  remoteProfileId: string | null;
  status: ExperimentRunStatus;
  manifest: ExperimentManifest | null;
  patchSummary: string | null;
  syncSummary: string | null;
  jobId: string | null;
  monitoringConfig: JobMonitoringConfig | null;
  lastPolledAt: string | null;
  statusSnapshot: RunStatusSnapshot | null;
  collectApprovedAt: string | null;
  resultSummary: ExperimentResultSummary | null;
  recommendation: AnalysisRecommendation | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================
// Workflow Stage
// =============================================================

export type WorkflowStageId =
  | "inspect"
  | "propose_patch"
  | "approve_patch"
  | "apply_patch"
  | "preview_sync"
  | "execute_sync"
  | "prepare_job"
  | "submit_job"
  | "monitor_job"
  | "approve_collect"
  | "collect_results"
  | "analyze_results"
  | "recommend_next";

export interface WorkflowStage {
  id: WorkflowStageId;
  roleId: ResearchExecRoleId;
  labelKey: string;
  requiresApproval: boolean;
}

// =============================================================
// Agent Roles
// =============================================================

export type ResearchExecRoleId =
  | "repo_agent"
  | "patch_agent"
  | "remote_agent"
  | "result_analyst"
  | "research_planner";

export interface ResearchExecRoleConfig {
  roleId: ResearchExecRoleId;
  displayName: string;
  icon: string;
  color: string;
}

// =============================================================
// Workflow Turn (one stage's output)
// =============================================================

export interface WorkflowTurn {
  stageId: WorkflowStageId;
  roleId: ResearchExecRoleId;
  content: string;
  artifacts?: Record<string, unknown>;
  timestamp: string;
}

// =============================================================
// Workflow Session State
// =============================================================

export interface WorkflowSessionState {
  id: string;
  runId: string;
  workspaceId: string;
  stages: WorkflowStage[];
  currentStageIndex: number;
  transcript: WorkflowTurn[];
  status: "idle" | "running" | "awaiting_approval" | "completed" | "error";
  error?: string;
}
