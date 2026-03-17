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
  | "queued"
  | "running"
  | "collecting"
  | "analyzing"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "needs_attention"
  | "unknown";

/** Structured mount for rjob containers. */
export interface RJobMount {
  source: string;
  target: string;
}

/** Structured representation of an `rjob submit` request. */
export interface RJobSubmissionSpec {
  jobName: string;
  memoryMb: number;
  cpu: number;
  gpu: number;
  chargedGroup?: string;
  privateMachine?: string;
  mounts: RJobMount[];
  image: string;
  priority?: number;
  hostNetwork?: boolean;
  autoRestart?: boolean;
  env?: Record<string, string>;
  command: string;
  commandArgs: string[];
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

/** Semantic completion state — whether a run has reached a terminal state. */
export type RunCompletionState =
  | "not_started"
  | "in_progress"
  | "terminal_success"
  | "terminal_failure"
  | "terminal_cancelled"
  | "undetermined";

/** Point-in-time observation of a remote run's status. Pure observation — no decision logic. */
export interface RunStatusSnapshot {
  observedAt: string;
  status: ExperimentRunStatus;
  completionState: RunCompletionState;
  schedulerState?: string;
  schedulerReason?: string;
  exitCode?: number | null;
  signalCode?: number | null;
  processAlive?: boolean;
  heartbeatSeenAt?: string;
  stdoutLogExists?: boolean;
  stderrLogExists?: boolean;
  logTailPreview?: string[];
  message?: string;
}

/** Discriminated union: output of monitorJob(). */
export type MonitorJobDecision =
  | { kind: "still_running"; snapshot: RunStatusSnapshot; retryAfterSeconds: number }
  | { kind: "completed"; snapshot: RunStatusSnapshot }
  | { kind: "failed"; snapshot: RunStatusSnapshot }
  | { kind: "cancelled"; snapshot: RunStatusSnapshot }
  | { kind: "unknown"; snapshot: RunStatusSnapshot; retryAfterSeconds?: number };

/** Lightweight reference to collected experiment results. */
export interface ExperimentResultSummaryRef {
  collectedAt: string;
  status: ExperimentRunStatus;
  completionState: RunCompletionState;
  metrics?: Record<string, number | string | boolean | null>;
  notes?: string;
}

/** Discriminated union: output of collectResults(). */
export type CollectResultsDecision =
  | { kind: "still_running"; snapshot: RunStatusSnapshot; retryAfterSeconds: number }
  | { kind: "awaiting_manual_approval"; snapshot: RunStatusSnapshot }
  | { kind: "collected"; snapshot: RunStatusSnapshot; result: ExperimentResultSummaryRef }
  | { kind: "not_ready"; snapshot: RunStatusSnapshot; reason: string };

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
