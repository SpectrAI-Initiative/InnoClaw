// =============================================================
// Deep Research — Type Definitions
// =============================================================

// --- Enums as union types ---

/** Valid transitions:
 * intake → running → paused | awaiting_approval | awaiting_user_confirmation | reviewing | awaiting_resource | completed | failed
 * paused → running
 * awaiting_approval → running
 * awaiting_user_confirmation → running | cancelled
 * reviewing → running | awaiting_user_confirmation
 * awaiting_resource → running | failed
 * failed → running (retry)
 */
export type SessionStatus =
  | "intake"
  | "planning"
  | "running"
  | "paused"
  | "awaiting_approval"
  | "awaiting_user_confirmation"
  | "awaiting_resource"
  | "reviewing"
  | "planning_in_progress"
  | "literature_in_progress"
  | "literature_blocked"
  | "awaiting_additional_literature"
  | "validation_planning_in_progress"
  | "execution_prepared"
  | "execution_in_progress"
  | "final_report_generated"
  | "completed"
  | "stopped_by_user"
  | "failed"
  | "cancelled";

export type ContextTag =
  | "intake"
  | "planning"
  | "final_report";

export const VALID_CONTEXT_TAGS: readonly ContextTag[] = [
  "intake",
  "planning",
  "final_report",
];

export type NodeType =
  | "intake"
  | "plan"
  | "evidence_gather"
  | "evidence_extract"
  | "summarize"
  | "synthesize"
  | "review"
  | "audit"
  | "validation_plan"
  | "resource_request"
  | "execute"
  | "monitor"
  | "result_collect"
  | "result_compare"
  | "approve"
  | "final_report"
  | "retrieve"
  | "synthesize_claims"
  | "data_download"
  | "preprocess"
  | "skill_route";

export type NodeStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "awaiting_approval"
  | "awaiting_user_confirmation"
  | "superseded";

export type ModelRole =
  | "main_brain"
  | "researcher"
  | "literature_intelligence_analyst"
  | "experiment_architecture_designer"
  | "research_software_engineer"
  | "experiment_operations_engineer"
  | "results_and_evidence_analyst"
  | "research_asset_reuse_specialist"
  | "worker"
  | "synthesizer";

export type StructuredRoleCategory = "main_brain" | "meta_worker";

export type StructuredPromptKind =
  | "system"
  | "task_intake"
  | "progress_update"
  | "handoff"
  | "escalation"
  | "completion";

export type StructuredSkillKind =
  | "literature_analysis"
  | "experiment_design"
  | "code_implementation"
  | "experiment_execution"
  | "result_analysis"
  | "artifact_packaging"
  | "coordination";

export interface StructuredRolePrompt {
  kind: StructuredPromptKind;
  title: string;
  objective: string;
  requiredSections: string[];
  constraints: string[];
}

export interface StructuredRoleSkill {
  id: string;
  kind: StructuredSkillKind;
  name: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  qualityChecks: string[];
}

export interface StructuredRoleCollaboration {
  partnerRoleId: ModelRole;
  collaborationType: "delegation" | "handoff" | "review" | "feedback" | "escalation" | "reuse";
  trigger: string;
  payload: string[];
  expectedResponse: string[];
}

export interface StructuredRoleDefinition {
  roleId: ModelRole;
  category: StructuredRoleCategory;
  roleName: string;
  workflowSegment: string;
  defaultNodeType: NodeType;
  defaultContextTag: ContextTag;
  summaryArtifactType: ArtifactType;
  corePositioning: string;
  coreResponsibilities: string[];
  skillRequirements: string[];
  collaborationRequirements: string[];
  performanceStandards: string[];
  prompts: StructuredRolePrompt[];
  skills: StructuredRoleSkill[];
  collaborations: StructuredRoleCollaboration[];
}

export interface StructuredCommunicationProtocol {
  id: string;
  fromRoleId: ModelRole;
  toRoleId: ModelRole;
  goal: string;
  trigger: string;
  requiredPayload: string[];
  responseContract: string[];
  escalationPath: string;
}

export interface StructuredTaskAssignment {
  roleId: ModelRole;
  roleName: string;
  workflowSegment: string;
  objective: string;
  deliverables: string[];
  dependencies: ModelRole[];
  status: "planned" | "in_progress" | "blocked" | "completed";
}

export interface StructuredTaskBoard {
  objective: string;
  coordinatorRoleId: ModelRole;
  assignments: StructuredTaskAssignment[];
  milestones: string[];
  completionCriteria: string[];
}

export interface StructuredHandoffPacket {
  type: "handoff" | "progress_update" | "escalation";
  fromRoleId: ModelRole;
  toRoleId: ModelRole;
  goal: string;
  payload: string[];
  expectedResponse: string[];
  status: "drafted" | "shared" | "acknowledged";
}

export type ArtifactType =
  | "research_brief"
  | "task_graph"
  | "evidence_card"
  | "literature_round_summary"
  | "structured_summary"
  | "reviewer_packet"
  | "review_assessment"
  | "main_brain_audit"
  | "provisional_conclusion"
  | "validation_plan"
  | "execution_manifest"
  | "execution_plan"
  | "step_result"
  | "experiment_result"
  | "validation_report"
  | "final_report"
  | "checkpoint"
  | "evidence_card_collection"
  | "claim_map"
  | "memory_profile"
  | "memory_snapshot"
  | "memory_index"
  | "data_manifest";

export type EventType =
  | "session_created"
  | "node_created"
  | "node_started"
  | "node_completed"
  | "node_failed"
  | "artifact_created"
  | "user_message"
  | "brain_response"
  | "approval_requested"
  | "approval_granted"
  | "approval_denied"
  | "session_completed"
  | "session_failed"
  | "checkpoint_created"
  | "confirmation_requested"
  | "user_confirmed"
  | "user_requested_revision"
  | "user_requested_branch"
  | "user_rejected_result"
  | "user_requested_stop"
  | "user_approved_execution"
  | "user_approved_remote_submission"
  | "literature_round_started"
  | "literature_round_completed"
  | "review_started"
  | "review_completed"
  | "execution_submitted"
  | "execution_completed"
  | "resource_requested"
  | "resource_acquired"
  | "requirement_changed"
  | "nodes_superseded"
  | "consistency_check"
  | "skill_routing_completed"
  | "synthesis_completed"
  | "execution_plan_created"
  | "data_download_completed";

export type MessageRole = "user" | "main_brain" | "system";

/** How the user responded to a confirmation gate. */
export type ConfirmationOutcome =
  | "confirmed"
  | "revision_requested"
  | "branch_requested"
  | "rejected"
  | "stopped";

// --- Core Interfaces ---

export interface DeepResearchSession {
  id: string;
  workspaceId: string;
  title: string;
  status: SessionStatus;
  contextTag: ContextTag;
  config: DeepResearchConfig;
  budget: BudgetUsage;
  /** ID of the latest checkpoint artifact when status is awaiting_user_confirmation. */
  pendingCheckpointId: string | null;
  /** Current literature round number (0 = not started). */
  literatureRound: number;
  /** Current review round number (0 = not started). */
  reviewerRound: number;
  /** Current execution loop number (0 = not started). */
  executionLoop: number;
  error: string | null;
  /** ID of the bound remote execution profile (from research-exec module). */
  remoteProfileId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeepResearchMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  /** Which node produced or relates to this message. */
  relatedNodeId: string | null;
  /** Which artifacts this message references. */
  relatedArtifactIds: string[];
  createdAt: string;
}

export interface DeepResearchNode {
  id: string;
  sessionId: string;
  parentId: string | null;
  nodeType: NodeType;
  label: string;
  status: NodeStatus;
  assignedRole: ModelRole;
  assignedModel: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  dependsOn: string[];
  supersedesId: string | null;
  supersededById: string | null;
  branchKey: string | null;
  retryOfId: string | null;
  retryCount: number;
  /** Which context tag spawned this node. */
  contextTag: ContextTag;
  /** Legacy compatibility field; workflow routing no longer depends on stage numbering. */
  stageNumber: number;
  /** Whether this node requires user confirmation after completion. */
  requiresConfirmation: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmationOutcome: ConfirmationOutcome | null;
  positionX: number | null;
  positionY: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeepResearchArtifact {
  id: string;
  sessionId: string;
  nodeId: string | null;
  artifactType: ArtifactType;
  title: string;
  content: Record<string, unknown>;
  provenance: ArtifactProvenance | null;
  version: number;
  createdAt: string;
}

export interface DeepResearchEvent {
  id: string;
  sessionId: string;
  eventType: EventType;
  nodeId: string | null;
  actorType: string | null;
  actorId: string | null;
  model: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

// --- Configuration ---

export interface DeepResearchConfig {
  modelOverrides?: Partial<Record<ModelRole, { provider: string; modelId: string }>>;
  /** The model resolved from settings at session creation time. */
  resolvedModel?: { provider: string; modelId: string };
  /** Keep the UI shell but disable the current orchestration/runtime. */
  interfaceOnly?: boolean;
  budget: BudgetLimits;
  /** Max number of worker nodes created per fan-out. */
  maxWorkerFanOut: number;
  /** Max review rounds before forcing advancement. */
  maxReviewerRounds: number;
  /** Max execution retry loops before forcing final report. */
  maxExecutionLoops: number;
  /** Max concurrent worker node executions. */
  maxWorkerConcurrency: number;
  /** Literature collection controls. */
  literature: LiteratureConfig;
  /** Execution controls. */
  execution: ExecutionConfig;
  /** Optional: enable dynamic skill routing. */
  skillRouting?: { enabled: boolean };
}

export interface LiteratureConfig {
  /** Max number of literature collection rounds (including reviewer-requested). */
  maxLiteratureRounds: number;
  /** Max papers per single literature round. */
  maxPapersPerRound: number;
  /** Max total papers across all rounds. */
  maxTotalPapers: number;
  /** Max rounds triggered by reviewer requests for more literature. */
  maxReviewerRequestedExpansionRounds: number;
  /** Max retries for failed searches within a single round. */
  maxSearchRetries: number;
}

export interface ExecutionConfig {
  /** Default launcher type for execution. */
  defaultLauncherType: LauncherType;
  /** Default resource profiles for rlaunch/rjob. */
  defaultResources: ResourceProfile;
  /** Default mounts for rlaunch/rjob. */
  defaultMounts: MountSpec[];
  /** Default charged group for resource allocation. */
  defaultChargedGroup: string;
}

// --- Budget ---

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

// --- Artifact & Review ---

export interface ArtifactProvenance {
  sourceNodeId: string;
  sourceArtifactIds: string[];
  model: string;
  generatedAt: string;
}

export interface ReviewerPacket {
  reviewerRole: "results_and_evidence_analyst";
  verdict: "approve" | "revise" | "reject";
  critique: string;
  suggestions: string[];
  confidence: number;
  /** Specific gaps the reviewer identifies that may need more literature. */
  identifiedGaps?: string[];
  /** Whether this reviewer thinks experimental validation is needed. */
  needsExperimentalValidation?: boolean;
  /** Specific experiments the reviewer suggests. */
  suggestedExperiments?: string[];
}

/** Final review assessment from the Results and Evidence Analyst. */
export interface ReviewAssessment {
  reviewerRole?: "results_and_evidence_analyst";
  reviewerSummary?: string;
  reviewHighlights?: string[];
  openIssues?: string[];
  reviewRounds?: number;
  combinedVerdict: "approve" | "revise" | "reject";
  combinedConfidence: number;
  /** What would reduce uncertainty. */
  uncertaintyReducers: string[];
  /** Whether reviewers recommend more literature. */
  needsMoreLiterature: boolean;
  /** Specific literature gaps identified. */
  literatureGaps: string[];
  /** Whether reviewers recommend experimental validation. */
  needsExperimentalValidation: boolean;
  /** Suggested experiments from reviewers. */
  suggestedExperiments: string[];
}

/** Main brain's audit/opinion on a stage result, shown at every checkpoint. */
export interface MainBrainAudit {
  /** What was completed in this stage. */
  whatWasCompleted: string;
  /** Whether the main brain thinks the result is correct/good. */
  resultAssessment: "good" | "acceptable" | "concerning" | "problematic";
  /** Specific issues or risks the main brain sees. */
  issuesAndRisks: string[];
  /** What the main brain recommends as the next action. */
  recommendedNextAction: string;
  /** What "Continue" will do if the user clicks it. */
  continueWillDo: string;
  /** Alternative actions the user could take. */
  alternativeActions: AlternativeAction[];
  /** Whether the main brain has sufficient confidence to proceed. */
  canProceed: boolean;
}

export interface AlternativeAction {
  label: string;
  description: string;
  /** Maps to a ConfirmationOutcome or custom action. */
  actionType: "continue" | "revise" | "retry" | "more_literature" | "fix_code" | "change_params" | "more_resources" | "stop";
}

// --- Literature Rounds ---

export interface LiteratureRoundState {
  roundId: string;
  roundNumber: number;
  targetQuestion: string;
  subQuestions: string[];
  maxPapers: number;
  currentPaperCount: number;
  status: "pending" | "running" | "completed" | "failed";
  completionReason: string | null;
  /** Who/what requested this round. */
  requestedBy: "main_brain" | "reviewer_request" | "user_request";
  /** Summary of what this round covered. */
  coverageSummary: string | null;
  /** Evidence node IDs created for this round. */
  nodeIds: string[];
  createdAt: string;
}

// --- Execution / Resource Acquisition ---

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

/** Structured rlaunch request. */
export interface RLaunchManifest {
  launcherType: "rlaunch";
  gpu: number;
  memoryMb: number;
  cpu: number;
  chargedGroup: string;
  privateMachine: "yes" | "no" | "group";
  mounts: MountSpec[];
  maxWaitDuration: string;
  command: string;
  /** Human-readable description of what this request is for. */
  purpose: string;
}

/** Structured rjob submission request. */
export interface RJobManifest {
  launcherType: "rjob";
  jobName: string;
  gpu: number;
  memoryMb: number;
  cpu: number;
  chargedGroup: string;
  privateMachine: "yes" | "no" | "group";
  mounts: MountSpec[];
  image: string;
  command: string;
  commandArgs: string[];
  env?: Record<string, string>;
  priority?: number;
  hostNetwork?: boolean;
  /** Human-readable description of what this job will do. */
  purpose: string;
}

export type ExecutionManifest = RLaunchManifest | RJobManifest | SlurmManifest;

/** Tracks the lifecycle of one execution/job submission. */
export interface ExecutionRecord {
  id: string;
  sessionId: string;
  nodeId: string;
  manifest: ExecutionManifest;
  status: "pending" | "submitted" | "running" | "completed" | "failed" | "cancelled";
  /** Remote job ID if applicable. */
  remoteJobId: string | null;
  /** Sanitized command shown to user. */
  sanitizedCommand: string;
  /** Output/result bundle. */
  resultBundle: Record<string, unknown> | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Validation plan that ties literature evidence back to experimental validation. */
export interface ValidationPlan {
  objective: string;
  hypothesis: string;
  /** What the literature and reviewer debate suggests should happen. */
  literaturePrediction: string;
  /** Required resources. */
  requiredResources: ResourceProfile;
  /** Datasets needed. */
  datasets: string[];
  /** Scripts/commands to run. */
  steps: ValidationStep[];
  /** What outputs are expected. */
  expectedOutputs: string[];
  /** How to determine failure. */
  failureCriteria: string[];
  /** How to determine success. */
  successCriteria: string[];
}

export interface ValidationStep {
  stepNumber: number;
  description: string;
  command?: string;
  scriptPath?: string;
  launcherType?: LauncherType;
  requiresApproval: boolean;
  expectedDuration?: string;
}

// --- Brain Decisions ---

export interface BrainDecision {
  action: "advance_context" | "revise_plan" | "request_approval" | "complete" | "respond_to_user";
  nextContextTag?: ContextTag;
  nodesToCreate?: NodeCreationSpec[];
  messageToUser?: string;
  reasoning?: string;
}

export type CheckpointInteractionMode = "confirmation" | "answer_required";

export interface NodeCreationSpec {
  nodeType: NodeType;
  label: string;
  assignedRole: ModelRole;
  input?: Record<string, unknown>;
  dependsOn?: string[];
  parentId?: string;
  branchKey?: string;
  contextTag?: ContextTag;
}

// --- Checkpoint Package ---

export interface CheckpointPackage {
  checkpointId: string;
  sessionId: string;
  nodeId: string;
  stepType: string;
  contextTag: ContextTag;
  title: string;
  humanSummary: string;
  machineSummary: string;
  /** Main brain's audit/opinion on this stage result. */
  mainBrainAudit: MainBrainAudit;
  artifactsToReview: string[];
  currentFindings: string;
  openQuestions: string[];
  recommendedNextAction: string;
  recommendedWorker?: {
    roleId: ModelRole;
    roleName: string;
    nodeType: NodeType;
    label: string;
  };
  promptUsed?: {
    title: string;
    kind: StructuredPromptKind;
    objective: string;
  };
  /** What clicking "Continue" will actually do. */
  continueWillDo: string;
  alternativeNextActions: string[];
  requiresUserConfirmation: boolean;
  interactionMode?: CheckpointInteractionMode;
  isFinalStep?: boolean;
  /** Computed transition action from TransitionResolver. */
  transitionAction?: TransitionAction;
  /** Literature round info if relevant. */
  literatureRoundInfo?: {
    roundNumber: number;
    papersCollected: number;
    retrievalTaskCount: number;
    successfulTaskCount: number;
    failedTaskCount: number;
    emptyTaskCount: number;
    coverageSummary: string;
  };
  /** Review assessment info if relevant. */
  reviewInfo?: ReviewAssessment;
  /** Validation/execution info if relevant. */
  executionInfo?: {
    stepsCompleted: number;
    stepsTotal: number;
    currentStatus: string;
  };
  createdAt: string;
}

/** What the main brain decides after reading user confirmation feedback. */
export type ConfirmationAction =
  | "continue"
  | "revise"
  | "retry"
  | "branch"
  | "supersede"
  | "stop";

export interface ConfirmationDecision {
  action: ConfirmationAction;
  reasoning: string;
  nodesToCreate?: NodeCreationSpec[];
  nextContextTag?: ContextTag;
  messageToUser?: string;
}

// --- Default Config ---

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

// =============================================================
// RequirementState & ConstraintState
// =============================================================

export type RequirementStatus = "active" | "satisfied" | "dropped";
export type ConstraintType = "budget" | "time" | "scope" | "method" | "resource";
export type ConstraintStatus = "active" | "relaxed" | "violated";

export interface Requirement {
  id: string;
  text: string;
  source: string;
  priority: "critical" | "high" | "medium" | "low";
  status: RequirementStatus;
  satisfiedByNodeIds: string[];
  addedAtContextTag: ContextTag;
}

export interface Constraint {
  id: string;
  text: string;
  type: ConstraintType;
  value: string;
  status: ConstraintStatus;
  addedAtContextTag: ContextTag;
}

export interface RequirementState {
  requirements: Requirement[];
  constraints: Constraint[];
  version: number;
  lastModifiedAt: string;
  lastModifiedBy: string;
  /** Original user goal text (never changes). */
  originalUserGoal: string;
  /** Currently approved goal (may differ from original after user feedback). */
  currentApprovedGoal: string;
  /** Latest user instruction/feedback text. */
  latestUserInstruction: string | null;
  /** Approved research scope description. */
  approvedResearchScope: string | null;
  /** Approved experiment scope description. */
  approvedExperimentScope: string | null;
  /** Whether execution is explicitly allowed. */
  executionAllowed: boolean;
  /** Main brain's latest accepted interpretation of user goal. */
  latestMainBrainAcceptedInterpretation: string | null;
  /** Version this state supersedes. */
  supersedesVersion: number | null;
}

export interface RequirementDiff {
  added: Requirement[];
  removed: Requirement[];
  modified: Array<{ id: string; field: string; oldValue: unknown; newValue: unknown }>;
  constraintsChanged: boolean;
}

// =============================================================
// TransitionAction
// =============================================================

export interface TransitionAction {
  nextContextTag: ContextTag;
  nodesToCreate: NodeCreationSpec[];
  nodesToSupersede: string[];
  description: string;
}

// =============================================================
// Review History
// =============================================================

export interface ReviewRound {
  round: number;
  reviewerPacket: ReviewerPacket;
}

// Extend review assessment results with optional history fields.
export interface ReviewAssessmentExtended extends ReviewAssessment {
  rounds: ReviewRound[];
  reviewHistory?: ReviewRound[];
}

// =============================================================
// Execution Records
// =============================================================

export type ExecutionRecordType = "rlaunch" | "rjob" | "local";
export type ExecutionRecordStatus = "pending" | "submitted" | "running" | "completed" | "failed" | "cancelled";

export interface PersistedExecutionRecord {
  id: string;
  sessionId: string;
  nodeId: string;
  recordType: ExecutionRecordType;
  status: ExecutionRecordStatus;
  remoteJobId: string | null;
  remoteHost: string | null;
  command: string;
  configJson: Record<string, unknown>;
  resultJson: Record<string, unknown> | null;
  submittedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// =============================================================
// DAG Validation
// =============================================================

export type DAGErrorType = "cycle" | "orphan" | "dangling" | "duplicate";

export interface DAGError {
  type: DAGErrorType;
  nodeIds: string[];
  message: string;
}

export interface DAGValidationResult {
  valid: boolean;
  errors: DAGError[];
}

// =============================================================
// Consistency Check
// =============================================================

export interface ConsistencyReport {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

// =============================================================
// Actor Runtime Types
// =============================================================

export interface ActorExecutionContext {
  session: DeepResearchSession;
  messages: DeepResearchMessage[];
  allNodes: DeepResearchNode[];
  allArtifacts: DeepResearchArtifact[];
  skillCatalog?: Array<{ slug: string; name: string; description?: string | null }>;
  skillTools?: Record<string, unknown>;
}

export interface ActorArtifactDraft {
  artifactType: ArtifactType;
  title: string;
  content: Record<string, unknown>;
  provenance?: ArtifactProvenance | null;
}

export interface ActorExecutionResult {
  output: Record<string, unknown>;
  artifacts: DeepResearchArtifact[];
  tokensUsed: number;
}

// =============================================================
// Language State
// =============================================================

export interface LanguageState {
  /** Detected language of latest user message (e.g., "zh", "en", "ja"). */
  currentUserLanguage: string;
  /** Preferred output language for user-facing content. */
  preferredOutputLanguage: string;
  /** Last detected language before any override. */
  lastDetectedUserLanguage: string;
  /** When the language state was last updated. */
  lastLanguageUpdateAt: string;
}

// =============================================================
// Evidence Sufficiency
// =============================================================

export type EvidenceRetrievalStatus =
  | "success"
  | "partial"
  | "failed_retrieval"
  | "insufficient_evidence"
  | "empty";

export interface EvidenceSufficiencyReport {
  /** Overall sufficiency assessment. */
  sufficient: boolean;
  /** Per-stream status. */
  streams: Array<{
    nodeId: string;
    label: string;
    status: EvidenceRetrievalStatus;
    sourcesFound: number;
    failureReason?: string;
  }>;
  /** Total unique sources across all streams. */
  totalSources: number;
  /** Streams that failed or returned empty. */
  failedStreams: number;
  /** Whether synthesis should proceed (requires at least some evidence). */
  canSynthesize: boolean;
  /** Missing topics that need re-retrieval. */
  missingTopics: string[];
}

// =============================================================
// Evidence Cards — Structured evidence format
// =============================================================

export interface RawExcerpt {
  text: string;
  sourceIndex: number;
  page?: string;
  section?: string;
}

export interface SourceEntry {
  title: string;
  url: string;
  authors?: string[];
  year?: number;
  venue?: string;
  doi?: string;
  retrievalMethod: string;
  retrievedAt: string;
}

export interface EvidenceCard {
  id: string;
  query: string;
  sources: SourceEntry[];
  rawExcerpts: RawExcerpt[];
  retrievalStatus: EvidenceRetrievalStatus;
  /** Number of sources successfully retrieved. */
  sourcesFound: number;
  /** Total sources attempted. */
  sourcesAttempted: number;
  /** Free-text notes about retrieval quality. */
  retrievalNotes: string;
  createdAt: string;
}

export interface EvidenceCardCollection {
  cards: EvidenceCard[];
  totalSources: number;
  totalExcerpts: number;
  retrievalSummary: {
    successful: number;
    partial: number;
    failed: number;
    empty: number;
  };
}

// =============================================================
// Claim Map — Synthesizer output
// =============================================================

export type ClaimStrength = "strong" | "moderate" | "weak" | "unsupported";

export interface Claim {
  id: string;
  text: string;
  strength: ClaimStrength;
  supportingSources: number[];
  contradictingSources: number[];
  category: string;
  /** Distinguish what kind of knowledge this claim is. */
  knowledgeType: "retrieved_evidence" | "background_knowledge" | "assumption" | "speculation";
}

export interface Contradiction {
  claimAId: string;
  claimBId: string;
  description: string;
  possibleResolution: string;
}

export interface GapAnalysis {
  topic: string;
  description: string;
  suggestedQueries: string[];
  priority: "high" | "medium" | "low";
}

export interface ClaimMap {
  claims: Claim[];
  supportMatrix: Record<string, number[]>;
  contradictions: Contradiction[];
  gaps: GapAnalysis[];
  confidenceDistribution: Record<ClaimStrength, number>;
}

// =============================================================
// Memory Fabric — Long-running research memory
// =============================================================

export type ResearchMemoryKind = "semantic" | "episodic" | "procedural";

export type ResearchMemoryStatus = "active" | "superseded" | "archived";

export type ResearchMemoryCategory =
  | "user_goal"
  | "constraint"
  | "evidence"
  | "claim"
  | "gap"
  | "decision"
  | "execution"
  | "workflow";

export interface ResearchMemoryAnchor {
  artifactId?: string;
  artifactType?: ArtifactType;
  nodeId?: string;
  messageId?: string;
  sourceIndex?: number;
  excerptIndex?: number;
  claimId?: string;
  gapIndex?: number;
  field?: string;
  note?: string;
}

export interface ResearchMemoryItem {
  id: string;
  kind: ResearchMemoryKind;
  category: ResearchMemoryCategory;
  title: string;
  summary: string;
  details?: string;
  tags: string[];
  keywords: string[];
  importance: number;
  confidence: number;
  status: ResearchMemoryStatus;
  createdAt: string;
  updatedAt: string;
  provenance: {
    sourceType: "artifact" | "message" | "event" | "derived";
    artifactId?: string;
    nodeId?: string;
    eventId?: string;
    messageId?: string;
  };
  /** Exact back-pointers into the source-of-truth records for research traceability. */
  anchors?: ResearchMemoryAnchor[];
  relatedMemoryIds?: string[];
}

export interface ResearchMemoryProfile {
  sessionId: string;
  generatedAt: string;
  objective: string;
  currentPhase: ContextTag;
  latestCheckpointTitle?: string;
  latestRecommendedNextAction?: string;
  activeRequirements: string[];
  activeConstraints: string[];
  openQuestions: string[];
  activeHypotheses: string[];
  latestPlanSummary?: string;
  keyDecisions: string[];
}

export interface ResearchMemorySnapshot {
  sessionId: string;
  generatedAt: string;
  title: string;
  summary: string;
  acceptedFacts: string[];
  contestedFacts: string[];
  unresolvedGaps: string[];
  nextStep: string;
  focusAreas: string[];
  relatedArtifactIds: string[];
}

export interface ResearchMemoryIndex {
  sessionId: string;
  generatedAt: string;
  itemCount: number;
  /** Derived retrieval cache built from artifacts/messages, not the source of truth itself. */
  sourceOfTruth: "artifacts_and_messages";
  items: ResearchMemoryItem[];
  stats: {
    semanticCount: number;
    episodicCount: number;
    proceduralCount: number;
    activeCount: number;
  };
}

export interface ResearchMemoryRetrievalResult {
  profile: ResearchMemoryProfile;
  snapshot: ResearchMemorySnapshot | null;
  items: Array<ResearchMemoryItem & { retrievalScore: number }>;
  query: string;
}

// =============================================================
// Synthesizer-Facing Revision Request
// =============================================================

export interface ReviewPatternFlag {
  pattern: string;
  location: string;
  description: string;
  severity: "critical" | "major" | "minor";
  suggestedFix: string;
}

export interface ReviewRevisionRequest {
  /** ID of the review round that produced this request. */
  fromRound: number;
  /** Issue IDs that need addressing. */
  issueIds: string[];
  /** Point-by-point revision instructions for the synthesizer. */
  revisionPoints: RevisionPoint[];
  /** The ClaimMap artifact ID being revised. */
  targetClaimMapId: string;
  /** Anti-patterns to fix. */
  antiPatternsToFix: ReviewPatternFlag[];
}

export interface RevisionPoint {
  /** Which claim or section to revise. */
  target: string;
  /** What's wrong. */
  problem: string;
  /** What the reviewer expects after revision. */
  expectedOutcome: string;
  /** Linked issue ID. */
  issueId?: string;
}

// =============================================================
// Execution Planner — Multi-stage pipeline
// =============================================================

export interface DataRequirement {
  name: string;
  source: string;
  format: string;
  estimatedSizeGb: number;
  cachePath?: string;
}

export interface ExecutionStage {
  stageNumber: number;
  name: string;
  description: string;
  nodeType: NodeType;
  dependencies: number[];
  estimatedGPUHours: number;
  dataRequirements: DataRequirement[];
  commands: string[];
  expectedOutputs: string[];
}

export interface ExecutionPlanFull {
  stages: ExecutionStage[];
  totalEstimatedGPUHours: number;
  dataRequirements: DataRequirement[];
  prerequisites: string[];
}

export interface SlurmManifest {
  launcherType: "slurm";
  partition: string;
  account: string;
  nodes: number;
  gpusPerNode: number;
  time: string;
  modules: string[];
  command: string;
  jobName?: string;
  outputPath?: string;
  errorPath?: string;
}

// =============================================================
// Skill Library — Dynamic skill/task registry
// =============================================================

export type SkillCategory = "retrieval" | "synthesis" | "review" | "execution" | "report";

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  nodeType: NodeType;
  defaultRole: ModelRole;
  estimatedTokens: number;
}

export interface SkillRoutingDecision {
  selectedSkills: string[];
  reasoning: string;
  nodeSpecs: NodeCreationSpec[];
}

// =============================================================
// Execution Pipeline — Full experiment lifecycle
// =============================================================

export type ExperimentScale = "pilot" | "full" | "preprocess_only" | "eval_only" | "data_only";
export type ExperimentStatus =
  | "planning"
  | "data_pending"
  | "data_downloading"
  | "data_ready"
  | "preprocessing"
  | "preprocess_ready"
  | "submission_pending"
  | "submitted"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "dry_run";

export type SubmissionMode = "real" | "dry_run" | "mock";

/** Complete experiment specification produced by the execution planner. */
export interface ExperimentSpec {
  experimentId: string;
  sessionId: string;
  name: string;
  description: string;
  scale: ExperimentScale;
  status: ExperimentStatus;

  /** Task type classification. */
  taskType: string;

  /** Models used in the experiment. */
  models: string[];

  /** Data sources to acquire. */
  dataSources: DataSourceSpec[];

  /** Preprocessing pipeline. */
  preprocessing: PreprocessingPipelineSpec;

  /** Training/evaluation commands. */
  commands: ExperimentCommand[];

  /** Resource requirements. */
  resources: ExperimentResources;

  /** Mount specifications. */
  mounts: MountSpec[];

  /** Environment setup (modules, env vars, venv, etc.). */
  environment: EnvironmentSetup;

  /** Output configuration. */
  outputs: OutputConfig;

  /** Failure/retry policy. */
  retryPolicy: RetryPolicy;

  /** Submission mode. */
  submissionMode: SubmissionMode;

  /** Launcher type to use. */
  launcherType: LauncherType;

  /** Timestamps. */
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceSpec {
  id: string;
  name: string;
  source: "huggingface" | "github" | "url" | "local";
  identifier: string;
  subset?: string;
  split?: string;
  revision?: string;
  format?: string;
  estimatedSizeGb: number;
  cachePath: string;
  /** Auth token env var name (not the token itself). */
  authTokenEnvVar?: string;
}

export interface PreprocessingPipelineSpec {
  enabled: boolean;
  steps: PreprocessingStepSpec[];
  outputPath: string;
  outputFormat: string;
  /** Skip preprocessing if output already exists and inputs haven't changed. */
  skipIfCached: boolean;
}

export interface PreprocessingStepSpec {
  order: number;
  name: string;
  type: string;
  config: Record<string, unknown>;
  description: string;
  /** Expected output path for caching. */
  outputPath?: string;
  /** Version tag for cache invalidation. */
  version?: string;
}

export interface ExperimentCommand {
  name: string;
  command: string;
  args: string[];
  workingDir?: string;
  /** Stage this command belongs to. */
  stage: "setup" | "train" | "eval" | "postprocess";
  /** Dependencies (other command names that must complete first). */
  dependsOn: string[];
}

export interface ExperimentResources {
  gpu: number;
  gpuType?: string;
  cpu: number;
  memoryMb: number;
  diskGb?: number;
  walltime: string;
  privateMachine: "yes" | "no" | "group";
  maxWaitDuration?: string;
}

export interface EnvironmentSetup {
  modules: string[];
  envVars: Record<string, string>;
  condaEnv?: string;
  venvPath?: string;
  setupCommands: string[];
  workingDir: string;
}

export interface OutputConfig {
  baseDir: string;
  checkpointDir: string;
  logDir: string;
  metricsDir: string;
  artifactPatterns: string[];
}

export interface RetryPolicy {
  maxRetries: number;
  retryOnOOM: boolean;
  retryDelaySeconds: number;
  /** Scale down resources on OOM. */
  scaleDownOnOOM: boolean;
}

// --- Job submission ---

export type JobStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled" | "unknown";

export interface JobSubmissionResult {
  success: boolean;
  jobId: string | null;
  message: string;
  submittedAt: string;
  mode: SubmissionMode;
  /** Full rendered spec for inspection. */
  renderedSpec: string;
  /** Metadata from the submission. */
  metadata: Record<string, unknown>;
}

export interface JobStatusResult {
  jobId: string;
  status: JobStatus;
  exitCode?: number;
  runningTimeSec?: number;
  nodeList?: string[];
  message?: string;
  queriedAt: string;
}

// --- Dataset acquisition result ---

export type DatasetAcquisitionStatus = "pending" | "downloading" | "ready" | "failed" | "skipped";

export interface DatasetAcquisitionResult {
  sourceId: string;
  source: DataSourceSpec;
  status: DatasetAcquisitionStatus;
  localPath: string;
  sizeBytes?: number;
  fileCount?: number;
  checksum?: string;
  downloadedAt?: string;
  skippedReason?: string;
  error?: string;
  command: string;
}

// --- Preprocessing run result ---

export type PreprocessingStepStatus = "pending" | "running" | "completed" | "skipped" | "failed";

export interface PreprocessingStepResult {
  stepName: string;
  order: number;
  status: PreprocessingStepStatus;
  inputPath: string;
  outputPath: string;
  recordsIn?: number;
  recordsOut?: number;
  durationMs?: number;
  skippedReason?: string;
  error?: string;
  configHash?: string;
}

export interface PreprocessingRunResult {
  experimentId: string;
  pipelineName: string;
  steps: PreprocessingStepResult[];
  overallStatus: PreprocessingStepStatus;
  totalRecordsIn?: number;
  totalRecordsOut?: number;
  totalDurationMs: number;
  outputPath: string;
  manifestPath?: string;
}

// --- Experiment manifest (reproducibility) ---

export interface ExperimentManifest {
  experimentId: string;
  sessionId: string;
  createdAt: string;

  /** Exact dataset versions used. */
  datasets: Array<{
    sourceId: string;
    identifier: string;
    revision?: string;
    checksum?: string;
    localPath: string;
  }>;

  /** Preprocessing config used. */
  preprocessingConfig: PreprocessingPipelineSpec;

  /** Code version if available. */
  codeVersion?: string;

  /** Execution config. */
  executionConfig: {
    resources: ExperimentResources;
    environment: EnvironmentSetup;
    commands: ExperimentCommand[];
    launcherType: LauncherType;
  };

  /** Job submission details. */
  jobSubmission?: JobSubmissionResult;

  /** Output paths. */
  outputPaths: OutputConfig;

  /** Evaluation results if available. */
  evaluationSummary?: Record<string, unknown>;

  /** Final status. */
  status: ExperimentStatus;

  /** Timestamps. */
  startedAt?: string;
  completedAt?: string;
}

// --- Dry-run result ---

export interface DryRunResult {
  experimentId: string;
  mode: "dry_run";
  renderedJobSpec: string;
  renderedCommands: string[];
  estimatedResources: ExperimentResources;
  estimatedCost?: string;
  dataRequirements: DataSourceSpec[];
  preprocessingSteps: PreprocessingStepSpec[];
  warnings: string[];
  blockers: string[];
  readyToSubmit: boolean;
}

// --- Execution pipeline config ---

export interface ExecutionPipelineConfig {
  /** Root cache directory for datasets. */
  dataCacheDir: string;
  /** Root directory for experiment outputs. */
  experimentOutputRoot: string;
  /** Root directory for preprocessing outputs. */
  preprocessingOutputRoot: string;
  /** Default launcher type. */
  defaultLauncherType: LauncherType;
  /** Default resources. */
  defaultResources: ExperimentResources;
  /** Default mounts. */
  defaultMounts: MountSpec[];
  /** Charged/billing group. */
  chargedGroup: string;
  /** Default environment setup. */
  defaultEnvironment: Partial<EnvironmentSetup>;
  /** Default retry policy. */
  defaultRetryPolicy: RetryPolicy;
  /** Whether to skip dataset downloads if cache exists. */
  skipExistingData: boolean;
  /** Whether to skip preprocessing if output exists and config unchanged. */
  skipExistingPreprocessing: boolean;
}

export const DEFAULT_EXECUTION_PIPELINE_CONFIG: ExecutionPipelineConfig = {
  dataCacheDir: "/mnt/shared-storage-user/suencheng/data-cache",
  experimentOutputRoot: "/mnt/shared-storage-user/suencheng/experiments",
  preprocessingOutputRoot: "/mnt/shared-storage-user/suencheng/preprocessed",
  defaultLauncherType: "rjob",
  defaultResources: {
    gpu: 2,
    gpuType: undefined,
    cpu: 32,
    memoryMb: 200_000,
    walltime: "24:00:00",
    privateMachine: "yes",
  },
  defaultMounts: [
    { source: "gpfs://gpfs1/suencheng", target: "/mnt/shared-storage-user/suencheng" },
    { source: "gpfs://gpfs1/ai4sreason", target: "/mnt/shared-storage-user/ai4sreason" },
  ],
  chargedGroup: "ai4sdata_gpu",
  defaultEnvironment: {
    modules: [],
    envVars: {},
    setupCommands: [],
    workingDir: "/mnt/shared-storage-user/suencheng",
  },
  defaultRetryPolicy: {
    maxRetries: 1,
    retryOnOOM: true,
    retryDelaySeconds: 60,
    scaleDownOnOOM: false,
  },
  skipExistingData: true,
  skipExistingPreprocessing: true,
};

// =============================================================
// Execution Loop — Worker Decomposition & Multi-Round Types
// =============================================================

/** How a parent experiment is decomposed into workers. */
export type WorkerDecompositionStrategy =
  | "seed_sweep"
  | "hyperparameter_sweep"
  | "benchmark_shard"
  | "ablation"
  | "model_variant"
  | "replay_budget"
  | "preprocessing_shard"
  | "train_eval_split"
  | "custom";

/** Status of a single worker run within an experiment group. */
export type WorkerRunStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

/** A single worker run within an ExperimentGroup. */
export interface WorkerRun {
  workerId: string;
  parentExperimentId: string;
  groupId: string;
  /** Human label, e.g. "seed=42" or "lr=1e-4". */
  label: string;
  /** The spec for this specific worker (may override parent). */
  spec: ExperimentSpec;
  /** Job ID returned by the backend after submission. */
  jobId: string | null;
  status: WorkerRunStatus;
  /** Worker-specific parameter overrides. */
  paramOverrides: Record<string, unknown>;
  /** Collected metrics after completion. */
  metrics: Record<string, number>;
  /** Collected artifact paths. */
  artifactPaths: string[];
  /** Logs (truncated). */
  logTail: string;
  exitCode: number | null;
  /** Runtime in seconds. */
  runtimeSec: number | null;
  /** Error message if failed. */
  error: string | null;
  submittedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** A group of related worker runs forming one logical experiment. */
export interface ExperimentGroup {
  groupId: string;
  sessionId: string;
  /** Which execution round this group belongs to. */
  roundNumber: number;
  /** Parent experiment spec (workers derive from this). */
  parentSpec: ExperimentSpec;
  /** How the experiment was decomposed. */
  decompositionStrategy: WorkerDecompositionStrategy;
  /** All worker runs in this group. */
  workers: WorkerRun[];
  /** Dependency graph: workerId → list of workerIds it depends on. */
  dependencyGraph: Record<string, string[]>;
  /** Aggregation rules for combining worker results. */
  aggregationRules: AggregationRules;
  /** Validation criteria for this group. */
  validationCriteria: ValidationCriteria;
  /** Current group-level status. */
  status: "pending" | "running" | "completed" | "partially_failed" | "failed" | "cancelled";
  /** Aggregated result after all workers finish (or enough finish). */
  aggregatedResult: AggregatedResult | null;
  createdAt: string;
  completedAt: string | null;
}

/** Rules for aggregating results across workers in a group. */
export interface AggregationRules {
  /** How to combine numeric metrics across workers. */
  metricAggregation: "mean" | "median" | "min" | "max" | "all";
  /** Required fraction of workers that must succeed (0-1). */
  minSuccessRate: number;
  /** Metrics to aggregate. */
  metricsToAggregate: string[];
  /** Whether to compute variance across seeds. */
  computeVariance: boolean;
  /** Max acceptable coefficient of variation across seeds. */
  maxCoefficientOfVariation: number | null;
  /** Custom aggregation function name (for extensibility). */
  customAggregator: string | null;
}

/** Combined result from aggregating multiple worker runs. */
export interface AggregatedResult {
  groupId: string;
  totalWorkers: number;
  succeededWorkers: number;
  failedWorkers: number;
  /** Aggregated metrics (key → {mean, std, min, max, values}). */
  metrics: Record<string, AggregatedMetric>;
  /** All collected artifact paths across workers. */
  allArtifactPaths: string[];
  /** Per-worker summary. */
  workerSummaries: Array<{
    workerId: string;
    label: string;
    status: WorkerRunStatus;
    metrics: Record<string, number>;
    runtimeSec: number | null;
  }>;
  aggregatedAt: string;
}

export interface AggregatedMetric {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  values: number[];
  coefficientOfVariation: number;
}

// =============================================================
// Execution Validation
// =============================================================

export type ValidationVerdict = "pass" | "fail" | "inconclusive";

export interface ValidationCriteria {
  /** Required metrics and their thresholds. */
  metricThresholds: Array<{
    metric: string;
    operator: "gte" | "lte" | "gt" | "lt" | "eq" | "between";
    value: number;
    upperBound?: number;
  }>;
  /** Required artifact patterns that must exist. */
  requiredArtifacts: string[];
  /** Min number of successful workers. */
  minSuccessfulWorkers: number;
  /** Max acceptable variance across seeds. */
  maxVariance: number | null;
  /** Whether baseline comparison is required. */
  baselineRequired: boolean;
  /** Baseline metric values for comparison. */
  baselineMetrics: Record<string, number>;
  /** Custom pass conditions (human-readable for LLM evaluation). */
  customConditions: string[];
}

export interface ExecutionValidationResult {
  verdict: ValidationVerdict;
  /** Overall score 0-1. */
  confidenceScore: number;
  /** Per-criterion results. */
  criterionResults: Array<{
    criterion: string;
    passed: boolean;
    actual: string;
    expected: string;
    note: string;
  }>;
  /** What's missing. */
  missingArtifacts: string[];
  /** Metric comparison results. */
  metricComparisons: Array<{
    metric: string;
    actual: number;
    threshold: number;
    operator: string;
    passed: boolean;
  }>;
  /** Reasons for the verdict. */
  reasons: string[];
  /** Blockers preventing a pass. */
  blockers: string[];
  /** Suggestions for fixing failures. */
  retrySuggestion: string | null;
  replanSuggestion: string | null;
  /** Severity of failure. */
  severity: "none" | "minor" | "major" | "critical";
  validatedAt: string;
}

// =============================================================
// Experiment Analysis (for failed/inconclusive runs)
// =============================================================

export type ExperimentFailureCategory =
  | "resource_underallocation"
  | "launcher_failure"
  | "data_issue"
  | "preprocessing_bug"
  | "metric_mismatch"
  | "unstable_training"
  | "incorrect_hypothesis"
  | "missing_baseline"
  | "implementation_bug"
  | "negative_scientific_result"
  | "timeout"
  | "oom"
  | "infrastructure_failure"
  | "unknown";

export type ExperimentAnalysisRecommendation =
  | "rerun_unchanged"
  | "rerun_with_fixes"
  | "redesign_experiment"
  | "narrow_scope"
  | "increase_resources"
  | "fix_data_pipeline"
  | "add_baseline"
  | "stop_research"
  | "pivot_hypothesis";

export interface ExperimentAnalysisResult {
  analysisId: string;
  groupId: string;
  roundNumber: number;
  /** Root cause candidates ranked by likelihood. */
  rootCauses: Array<{
    category: ExperimentFailureCategory;
    description: string;
    confidence: number;
    supportingEvidence: string[];
  }>;
  /** Top recommendation. */
  primaryRecommendation: ExperimentAnalysisRecommendation;
  /** All recommendations with reasoning. */
  recommendations: Array<{
    action: ExperimentAnalysisRecommendation;
    reasoning: string;
    estimatedEffort: "low" | "medium" | "high";
    requiredChanges: string[];
  }>;
  /** Whether to rerun unchanged. */
  shouldRerun: boolean;
  /** Whether to redesign. */
  shouldRedesign: boolean;
  /** Whether to stop entirely. */
  shouldStop: boolean;
  /** Specific fixes if rerunning. */
  suggestedFixes: Array<{
    target: string;
    fix: string;
    priority: "critical" | "high" | "medium" | "low";
  }>;
  /** Summary for Main Brain. */
  summaryForMainBrain: string;
  analyzedAt: string;
}

// =============================================================
// Execution Round — Iterative Loop Tracking
// =============================================================

export interface ExecutionRound {
  roundNumber: number;
  sessionId: string;
  /** The plan that was approved for this round. */
  planSnapshot: ValidationPlan;
  /** Worker group for this round. */
  group: ExperimentGroup | null;
  /** Validation result for this round. */
  validationResult: ExecutionValidationResult | null;
  /** Analysis result if validation failed/inconclusive. */
  analysisResult: ExperimentAnalysisResult | null;
  /** What changed from the previous round. */
  changesFromPrevious: string[];
  /** Whether Main Brain decided to continue after this round. */
  continueDecision: "continue" | "replan" | "stop" | "pending";
  /** Reason for the decision. */
  decisionReason: string;
  status: "planning" | "executing" | "validating" | "analyzing" | "replanning" | "completed" | "stopped";
  startedAt: string;
  completedAt: string | null;
}

/** Full execution lineage across all rounds. */
export interface ExecutionLineage {
  sessionId: string;
  rounds: ExecutionRound[];
  currentRound: number;
  maxRounds: number;
  /** Whether the hypothesis has been falsified. */
  hypothesisFalsified: boolean;
  /** Count of consecutive failures (for stop condition). */
  consecutiveFailures: number;
  /** Whether any round passed validation. */
  hasPassingRound: boolean;
  /** Summary of evidence across all rounds. */
  cumulativeEvidence: string[];
}

// =============================================================
// Remote Execution Configuration (SSH)
// =============================================================

export interface RemoteExecutionConfig {
  /** Remote hostname or IP. */
  host: string;
  /** SSH port. */
  port: number;
  /** Username for SSH. */
  username: string;
  /** Path to SSH private key (or "agent" to use ssh-agent). */
  keyPath: string;
  /** Remote working directory. */
  remoteWorkDir: string;
  /** Remote environment setup commands. */
  remoteSetupCommands: string[];
  /** Which launchers are available on the remote. */
  availableLaunchers: LauncherType[];
  /** Connection timeout in ms. */
  connectTimeoutMs: number;
  /** Command timeout in ms. */
  commandTimeoutMs: number;
}

export const DEFAULT_REMOTE_EXECUTION_CONFIG: RemoteExecutionConfig = {
  host: "",
  port: 22,
  username: "",
  keyPath: "agent",
  remoteWorkDir: "/tmp/deep-research",
  remoteSetupCommands: [],
  availableLaunchers: ["rjob", "rlaunch"],
  connectTimeoutMs: 30_000,
  commandTimeoutMs: 600_000,
};

// =============================================================
// Worker Fanout Plan (from execution planner)
// =============================================================

export interface WorkerFanoutPlan {
  /** Parent experiment spec. */
  parentSpec: ExperimentSpec;
  /** How to decompose. */
  strategy: WorkerDecompositionStrategy;
  /** Parameter space to sweep. */
  parameterSpace: Array<{
    name: string;
    values: unknown[];
  }>;
  /** Total number of workers to create. */
  totalWorkers: number;
  /** Maximum serialized worker slots. Deep research currently runs one at a time. */
  maxParallel: number;
  /** Whether to run a pilot worker first. */
  pilotFirst: boolean;
  /** Dependency structure. */
  dependencyType: "independent" | "sequential" | "staged_dag";
  /** Validation criteria. */
  validationCriteria: ValidationCriteria;
  /** Aggregation rules. */
  aggregationRules: AggregationRules;
  /** Estimated total GPU hours. */
  estimatedTotalGPUHours: number;
  /** Resource template per worker. */
  perWorkerResources: ExperimentResources;
}

// =============================================================
// Extended Job Submission — Logs & Outputs
// =============================================================

export interface JobLogResult {
  jobId: string;
  stdout: string;
  stderr: string;
  truncated: boolean;
  fetchedAt: string;
}

export interface JobOutputResult {
  jobId: string;
  /** Discovered output files. */
  files: Array<{
    path: string;
    sizeBytes: number;
    isMetrics: boolean;
  }>;
  /** Parsed metrics if found. */
  metrics: Record<string, number>;
  /** Raw metrics JSON content if found. */
  metricsRaw: string | null;
  fetchedAt: string;
}
