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
  | "reviewer_battle_in_progress"
  | "awaiting_additional_literature"
  | "validation_planning_in_progress"
  | "execution_prepared"
  | "execution_in_progress"
  | "final_report_generated"
  | "completed"
  | "stopped_by_user"
  | "failed"
  | "cancelled";

export type Phase =
  | "intake"
  | "planning"
  | "evidence_collection"
  | "literature_synthesis"
  | "reviewer_deliberation"
  | "decision"
  | "additional_literature"
  | "validation_planning"
  | "resource_acquisition"
  | "experiment_execution"
  | "validation_review"
  | "final_report";

export const PHASE_ORDER: Phase[] = [
  "intake",
  "planning",
  "evidence_collection",
  "literature_synthesis",
  "reviewer_deliberation",
  "decision",
  "additional_literature",
  "validation_planning",
  "resource_acquisition",
  "experiment_execution",
  "validation_review",
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
  | "deliberate"
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
  | "scientific_review"
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
  | "reviewer_a"
  | "reviewer_b"
  | "worker"
  | "synthesizer";

export type ArtifactType =
  | "research_brief"
  | "task_graph"
  | "evidence_card"
  | "literature_round_summary"
  | "structured_summary"
  | "reviewer_packet"
  | "reviewer_battle_result"
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
  | "scientific_review_packet"
  | "scientific_review_result"
  | "data_manifest";

export type EventType =
  | "session_created"
  | "phase_changed"
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
  | "reviewer_battle_started"
  | "reviewer_battle_completed"
  | "execution_submitted"
  | "execution_completed"
  | "resource_requested"
  | "resource_acquired"
  | "requirement_changed"
  | "nodes_superseded"
  | "consistency_check"
  | "skill_routing_completed"
  | "synthesis_completed"
  | "scientific_review_completed"
  | "execution_plan_created"
  | "data_download_completed"
  | "phase_jumped"
  | "phase_skipped";

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
  phase: Phase;
  config: DeepResearchConfig;
  budget: BudgetUsage;
  /** ID of the latest checkpoint artifact when status is awaiting_user_confirmation. */
  pendingCheckpointId: string | null;
  /** Current literature round number (0 = not started). */
  literatureRound: number;
  /** Current reviewer battle round number (0 = not started). */
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
  /** Which phase spawned this node. */
  phase: Phase;
  /** Stage number for sequential ordering (from PHASE_STAGE_NUMBER). */
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
  budget: BudgetLimits;
  /** Max number of worker nodes created per fan-out. */
  maxWorkerFanOut: number;
  /** Max reviewer battle rounds before forcing advancement. */
  maxReviewerRounds: number;
  /** Max execution retry loops before forcing final report. */
  maxExecutionLoops: number;
  /** Max concurrent worker node executions. */
  maxWorkerConcurrency: number;
  /** Literature collection controls. */
  literature: LiteratureConfig;
  /** Execution controls. */
  execution: ExecutionConfig;
  /** Optional: enable structured scientific review (dimension-based audit with anti-loop). */
  scientificReview?: ScientificReviewConfig;
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
  reviewerRole: "reviewer_a" | "reviewer_b";
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

/** Result of a reviewer battle — synthesized from two reviewer packets. */
export interface ReviewerBattleResult {
  reviewerAPosition: string;
  reviewerBPosition: string;
  agreements: string[];
  disagreements: string[];
  rebuttalHighlights: string[];
  unresolvedGaps: string[];
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
  action: "advance_phase" | "revise_plan" | "request_approval" | "complete" | "respond_to_user";
  nextPhase?: Phase;
  nodesToCreate?: NodeCreationSpec[];
  messageToUser?: string;
  reasoning?: string;
}

export interface NodeCreationSpec {
  nodeType: NodeType;
  label: string;
  assignedRole: ModelRole;
  input?: Record<string, unknown>;
  dependsOn?: string[];
  parentId?: string;
  branchKey?: string;
  phase?: Phase;
}

// --- Checkpoint Package ---

export interface CheckpointPackage {
  checkpointId: string;
  sessionId: string;
  nodeId: string;
  stepType: string;
  phase: Phase;
  title: string;
  humanSummary: string;
  machineSummary: string;
  /** Main brain's audit/opinion on this stage result. */
  mainBrainAudit: MainBrainAudit;
  artifactsToReview: string[];
  currentFindings: string;
  openQuestions: string[];
  recommendedNextAction: string;
  /** What clicking "Continue" will actually do. */
  continueWillDo: string;
  alternativeNextActions: string[];
  requiresUserConfirmation: boolean;
  isFinalStep?: boolean;
  /** Computed transition action from TransitionResolver. */
  transitionAction?: TransitionAction;
  /** Literature round info if relevant. */
  literatureRoundInfo?: {
    roundNumber: number;
    papersCollected: number;
    coverageSummary: string;
  };
  /** Reviewer battle info if relevant. */
  reviewerBattleInfo?: ReviewerBattleResult;
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
  nextPhase?: Phase;
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
  budget: {
    maxTotalTokens: 2_000_000,
    maxOpusTokens: 500_000,
  },
  maxWorkerFanOut: 8,
  maxReviewerRounds: 2,
  maxExecutionLoops: 3,
  maxWorkerConcurrency: 4,
  literature: DEFAULT_LITERATURE_CONFIG,
  execution: DEFAULT_EXECUTION_CONFIG,
};

export function createEmptyUsage(): BudgetUsage {
  return { totalTokens: 0, opusTokens: 0, byRole: {}, byNode: {} };
}

// =============================================================
// RequirementState & ConstraintState (Phase 1)
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
  addedAtPhase: Phase;
}

export interface Constraint {
  id: string;
  text: string;
  type: ConstraintType;
  value: string;
  status: ConstraintStatus;
  addedAtPhase: Phase;
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
// TransitionAction (Phase 3)
// =============================================================

export interface TransitionAction {
  nextPhase: Phase;
  nodesToCreate: NodeCreationSpec[];
  nodesToSupersede: string[];
  description: string;
}

// =============================================================
// Multi-Round Reviewer Battle (Phase 4)
// =============================================================

export interface ReviewerRound {
  round: number;
  reviewerAPacket: ReviewerPacket;
  reviewerBPacket: ReviewerPacket;
}

// Extend ReviewerBattleResult with multi-round fields
export interface ReviewerBattleResultExtended extends ReviewerBattleResult {
  rounds: ReviewerRound[];
  convergedAtRound: number | null;
  agreementScore: number;
}

// =============================================================
// Execution Records (Phase 5)
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
// DAG Validation (Phase 7)
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
// Consistency Check (Phase 8)
// =============================================================

export interface ConsistencyReport {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

// =============================================================
// Phase Handler Types (Phase 12)
// =============================================================

export interface PhaseContext {
  session: DeepResearchSession;
  nodes: DeepResearchNode[];
  artifacts: DeepResearchArtifact[];
  messages: DeepResearchMessage[];
  requirementState: RequirementState | null;
  languageState: LanguageState | null;
  config: DeepResearchConfig;
  abortSignal?: AbortSignal;
}

export interface PhaseResult {
  nextPhase?: Phase;
  nodesCreated: DeepResearchNode[];
  artifactsCreated: DeepResearchArtifact[];
  checkpoint?: CheckpointPackage;
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
// Scientific Review Config
// =============================================================

export interface ScientificReviewConfig {
  /** Max review rounds before forced decision (default 3). */
  maxRounds: number;
  /** Convergence threshold: early stop if all dimension diffs ≤ this (default 1). */
  convergenceThreshold: number;
  /** Minimum passing score per dimension (default 3). */
  minimumDimensionScore: number;
  /** Early stop if both reviewers pass all dimensions with no critical blockers. */
  earlyStopOnAllPassing: boolean;
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
// Scientific Review — Dimension-based audit
// =============================================================

export type ReviewDimension =
  | "problem_definition"
  | "literature_grounding"
  | "mechanism_validity"
  | "baseline_coverage"
  | "falsifiability"
  | "metric_design"
  | "compute_feasibility"
  | "data_feasibility"
  | "engineering_readiness"
  | "domain_mismatch_risk"
  | "novelty_positioning"
  | "reproducibility"
  | "overclaiming_risk";

export interface DimensionScore {
  dimension: ReviewDimension;
  score: number; // 1-5
  justification: string;
  suggestedImprovement?: string;
}

export type ScientificVerdict = "pass" | "revise" | "experimental_pivot" | "reject";

export interface ScientificBlocker {
  issue: string;
  severity: "critical" | "major" | "minor";
  whyItMatters: string;
  evidenceForIssue: string;
  repairAction: string;
  passCondition: string;
}

export interface RepairPath {
  blockerId: string;
  action: string;
  estimatedEffort: "low" | "medium" | "high";
  prerequisite?: string;
}

export interface ScientificReviewPacket {
  reviewerRole: "reviewer_a" | "reviewer_b";
  round: number;
  dimensions: DimensionScore[];
  overallScore: number;
  verdict: ScientificVerdict;
  criticalBlockers: ScientificBlocker[];
  majorIssues: ScientificBlocker[];
  minorSuggestions: string[];
  repairPaths: RepairPath[];
  passConditions: string[];
  /** Tracked issues with persistent IDs across rounds. */
  trackedIssues?: ReviewIssue[];
  /** Anti-pattern flags detected in the synthesis. */
  antiPatternFlags?: AntiPatternFlag[];
}

export interface ScientificReviewResult {
  canProceed: boolean;
  proceedConditions: string[];
  actionableRepairs: RepairPath[];
  dimensionAggregates: Record<ReviewDimension, { avgScore: number; trend: "improving" | "stable" | "declining" }>;
  rounds: Array<{
    round: number;
    reviewerAPacket: ScientificReviewPacket;
    reviewerBPacket: ScientificReviewPacket;
  }>;
  convergedAtRound: number | null;
  finalVerdict: ScientificVerdict;
  /** Consolidated issue ledger across all rounds. */
  issueLedger?: ReviewIssue[];
  /** Whether progression was acceptance-gated (vs max-rounds-reached). */
  acceptanceGated: boolean;
}

// =============================================================
// Issue Tracking — Persistent across review rounds
// =============================================================

export type ReviewIssueStatus =
  | "open"
  | "partially_resolved"
  | "resolved"
  | "deferred"
  | "blocked";

export interface ReviewIssue {
  /** Persistent ID across rounds (e.g., "ISS-001"). */
  issueId: string;
  /** Round this issue was first raised. */
  raisedInRound: number;
  /** Which reviewer raised it. */
  raisedBy: "reviewer_a" | "reviewer_b";
  /** Current status. */
  status: ReviewIssueStatus;
  severity: "critical" | "major" | "minor";
  /** Short summary of the issue. */
  title: string;
  /** Detailed description. */
  description: string;
  /** What needs to happen to resolve this issue. */
  resolutionCriteria: string;
  /** History of status changes across rounds. */
  statusHistory: Array<{
    round: number;
    status: ReviewIssueStatus;
    note: string;
  }>;
  /** Linked blocker IDs if this issue maps to a ScientificBlocker. */
  linkedBlockerIds?: string[];
}

// =============================================================
// Anti-Pattern Detection
// =============================================================

export type AntiPatternType =
  | "citation_hallucination"
  | "benchmark_mismatch"
  | "metric_cherry_picking"
  | "unfounded_generalization"
  | "missing_ablation"
  | "dataset_contamination_risk"
  | "p_hacking_risk"
  | "survivorship_bias"
  | "scope_creep"
  | "circular_reasoning";

export interface AntiPatternFlag {
  pattern: AntiPatternType;
  /** Where in the synthesis this was detected. */
  location: string;
  /** Description of the specific instance. */
  description: string;
  severity: "critical" | "major" | "minor";
  /** Suggested fix. */
  suggestedFix: string;
}

// =============================================================
// Synthesizer-Facing Revision Request
// =============================================================

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
  antiPatternsToFix: AntiPatternFlag[];
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
// Stage numbering helpers
// =============================================================

/** Map phase to its canonical stage number. */
export const PHASE_STAGE_NUMBER: Record<Phase, number> = {
  intake: 0,
  planning: 1,
  evidence_collection: 2,
  literature_synthesis: 3,
  reviewer_deliberation: 4,
  decision: 5,
  additional_literature: 6,
  validation_planning: 7,
  resource_acquisition: 8,
  experiment_execution: 9,
  validation_review: 10,
  final_report: 11,
};

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
  /** How many can run in parallel. */
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
