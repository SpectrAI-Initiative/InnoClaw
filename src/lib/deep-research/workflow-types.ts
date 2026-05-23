import type {
  ArtifactType,
  ContextTag,
  ModelRole,
  NodeType,
} from "./status-types";
import type { StructuredPromptKind } from "./structured-types";

export interface ReviewAssessment {
  reviewerRole?: "results_and_evidence_analyst";
  reviewerSummary?: string;
  reviewHighlights?: string[];
  openIssues?: string[];
  reviewRounds?: number;
  combinedVerdict: "approve" | "revise" | "reject";
  combinedConfidence: number;
  uncertaintyReducers: string[];
  needsMoreLiterature: boolean;
  literatureGaps: string[];
  needsExperimentalValidation: boolean;
  suggestedExperiments: string[];
}

export interface AlternativeAction {
  label: string;
  description: string;
  actionType: "continue" | "revise" | "retry" | "more_literature" | "fix_code" | "change_params" | "more_resources" | "stop";
}

export interface MainBrainAudit {
  whatWasCompleted: string;
  resultAssessment: "good" | "acceptable" | "concerning" | "problematic";
  issuesAndRisks: string[];
  recommendedNextAction: string;
  continueWillDo: string;
  alternativeActions: AlternativeAction[];
  canProceed: boolean;
}

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

export interface TransitionAction {
  nextContextTag: ContextTag;
  nodesToCreate: NodeCreationSpec[];
  nodesToSupersede: string[];
  description: string;
}

export interface CheckpointPackage {
  checkpointId: string;
  sessionId: string;
  nodeId: string;
  stepType: string;
  contextTag: ContextTag;
  title: string;
  humanSummary: string;
  machineSummary: string;
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
  continueWillDo: string;
  alternativeNextActions: string[];
  requiresUserConfirmation: boolean;
  interactionMode?: CheckpointInteractionMode;
  isFinalStep?: boolean;
  transitionAction?: TransitionAction;
  literatureRoundInfo?: {
    roundNumber: number;
    papersCollected: number;
    retrievalTaskCount: number;
    successfulTaskCount: number;
    failedTaskCount: number;
    emptyTaskCount: number;
    coverageSummary: string;
  };
  reviewInfo?: ReviewAssessment;
  executionInfo?: {
    stepsCompleted: number;
    stepsTotal: number;
    currentStatus: string;
  };
  createdAt: string;
}

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
  originalUserGoal: string;
  currentApprovedGoal: string;
  latestUserInstruction: string | null;
  approvedResearchScope: string | null;
  approvedExperimentScope: string | null;
  executionAllowed: boolean;
  latestMainBrainAcceptedInterpretation: string | null;
  supersedesVersion: number | null;
}

export interface RequirementDiff {
  added: Requirement[];
  removed: Requirement[];
  modified: Array<{ id: string; field: string; oldValue: unknown; newValue: unknown }>;
  constraintsChanged: boolean;
}

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

export interface ConsistencyReport {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface LanguageState {
  currentUserLanguage: string;
  preferredOutputLanguage: string;
  lastDetectedUserLanguage: string;
  lastLanguageUpdateAt: string;
}

export type EvidenceRetrievalStatus =
  | "success"
  | "partial"
  | "failed_retrieval"
  | "insufficient_evidence"
  | "empty";

export interface EvidenceSufficiencyReport {
  sufficient: boolean;
  streams: Array<{
    nodeId: string;
    label: string;
    status: EvidenceRetrievalStatus;
    sourcesFound: number;
    failureReason?: string;
  }>;
  totalSources: number;
  failedStreams: number;
  canSynthesize: boolean;
  missingTopics: string[];
}

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
  sourcesFound: number;
  sourcesAttempted: number;
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

export type ClaimStrength = "strong" | "moderate" | "weak" | "unsupported";

export interface Claim {
  id: string;
  text: string;
  strength: ClaimStrength;
  supportingSources: number[];
  contradictingSources: number[];
  category: string;
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

export interface ChapterPacketQuote {
  citationKey: string;
  sourceTitle: string;
  quote: string;
  relevance: string;
  year?: number;
  url?: string;
}

export interface ChapterPacketClaim {
  id: string;
  text: string;
  strength: ClaimStrength;
  citationKeys: string[];
  supportingSourceTitles: string[];
  counterpoints: string[];
}

export interface ChapterPacket {
  id: string;
  title: string;
  objective: string;
  summary: string;
  keyTakeaways: string[];
  claims: ChapterPacketClaim[];
  supportingQuotes: ChapterPacketQuote[];
  citationKeys: string[];
  openQuestions: string[];
  recommendedSectionText: string;
}

export interface StructuredSummaryArtifactContent {
  summary: string;
  chapterPackets: ChapterPacket[];
  crossSectionThemes: string[];
  globalOpenQuestions: string[];
  citationKeys: string[];
  recommendedReportNarrative?: string;
}

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
// PIVOT / REFINE Types (from AutoResearchClaw)
// =============================================================

export type ResearchDecisionAction = "proceed" | "refine" | "pivot" | "request_review";

export interface ResearchDecision {
  action: ResearchDecisionAction;
  rationale: string;
  confidence: number;
  /** When pivoting: the new research direction. */
  newDirection?: string;
  /** When refining: what specifically to refine. */
  refinementTargets?: string[];
  /** Suggested node types to create for the next step. */
  suggestedNextNodes: string[];
  /** Artifact version tracking. */
  artifactVersionIncrement?: number;
}

export interface PivotDecision extends ResearchDecision {
  action: "pivot";
  newDirection: string;
  /** What didn't work in the current direction. */
  failureAnalysis: string;
  /** Alternative hypotheses to explore. */
  alternativeHypotheses: string[];
}

export interface RefineDecision extends ResearchDecision {
  action: "refine";
  refinementTargets: string[];
  /** What specific parameters / methods to change. */
  parameterChanges: Record<string, unknown>;
  /** Expected improvement from refinement. */
  expectedImprovement: string;
}

// =============================================================
// Multi-Agent Debate Types (from AutoResearchClaw)
// =============================================================

export type DebateRole = "moderator" | "skeptic" | "librarian" | "reproducer" | "scribe";

export interface DebateAgentOutput {
  role: DebateRole;
  perspective: string;
  arguments: string[];
  evidenceRefs: string[];
  confidenceScore: number;
  suggestedActions: string[];
}

export interface DebateRound {
  roundNumber: number;
  topic: string;
  agentOutputs: DebateAgentOutput[];
  consensusReached: boolean;
  consensusSummary: string;
  dissentingViews: string[];
  unresolvedIssues: string[];
}

export interface DebateRecord {
  topic: string;
  rounds: DebateRound[];
  finalConsensus: string;
  totalRounds: number;
  consensusReached: boolean;
  keyInsights: string[];
  actionItems: string[];
}

// =============================================================
// Evolution Store Types (from AutoResearchClaw)
// =============================================================

export type LessonCategory = "system" | "experiment" | "literature" | "hypothesis" | "writing" | "review";
export type LessonSeverity = "critical" | "high" | "medium" | "low";

export interface EvolutionLesson {
  id: string;
  category: LessonCategory;
  severity: LessonSeverity;
  stage: string;
  description: string;
  /** What we learned and how to improve. */
  recommendation: string;
  /** The session this lesson was extracted from. */
  sourceSessionId: string;
  /** The node that triggered this lesson. */
  sourceNodeId?: string;
  /** When the lesson was recorded. */
  recordedAt: string;
  /** Tags for searchability. */
  tags: string[];
  /** JSON string of relevant context data. */
  contextData?: Record<string, unknown>;
}

export interface EvolutionOverlay {
  /** Lessons relevant to the current stage/context. */
  lessons: EvolutionLesson[];
  /** Weighted relevance score (0-1) incorporating time-decay. */
  relevanceScore: number;
  /** Formatted prompt overlay text for injection. */
  promptOverlay: string;
}

// =============================================================
// Claim Verification Types (from AutoResearchClaw)
// =============================================================

export type ClaimVerificationStatus = "verified" | "partially_verified" | "unverified" | "fabricated" | "pending";

export interface VerifiedClaim {
  claimId: string;
  claimText: string;
  status: ClaimVerificationStatus;
  supportingSourceIds: string[];
  contradictingSourceIds: string[];
  confidenceScore: number;
  /** Whether the numeric values in this claim are grounded in experiment data. */
  numericGrounded: boolean;
  /** Ground-truth values from verified registry. */
  groundTruthValues?: Record<string, number>;
  /** Any discrepancies found. */
  discrepancies: string[];
}

export interface ClaimVerificationReport {
  totalClaims: number;
  verifiedCount: number;
  partiallyVerifiedCount: number;
  unverifiedCount: number;
  fabricatedCount: number;
  claims: VerifiedClaim[];
  overallTrustScore: number;
  recommendations: string[];
}

export interface FabricationFlag {
  claimId: string;
  claimText: string;
  reason: string;
  severity: "warning" | "critical";
  suggestedFix: string;
}

// =============================================================
// Experiment Repair Types (from AutoResearchClaw)
// =============================================================

export type DeficiencyType = "nan_inf" | "runtime_error" | "low_performance" | "missing_output" | "incomplete" | "other";

export interface ExperimentDiagnosis {
  deficiencyType: DeficiencyType;
  description: string;
  affectedFiles: string[];
  errorMessages: string[];
  rootCause: string;
  fixable: boolean;
}

export interface RepairCycleResult {
  cycle: number;
  diagnosis: ExperimentDiagnosis;
  repairApplied: boolean;
  repairDescription: string;
  qualityAfterRepair: number;
  error?: string;
}

export interface ExperimentRepairResult {
  success: boolean;
  totalCycles: number;
  finalQuality: number;
  cycleHistory: RepairCycleResult[];
  finalDiagnosis?: ExperimentDiagnosis;
}

// =============================================================
// Hardware Detection Types (from AutoResearchClaw)
// =============================================================

export type GpuType = "cuda" | "mps" | "cpu";
export type HardwareTier = "high" | "limited" | "cpu_only";

export interface HardwareProfile {
  hasGpu: boolean;
  gpuType: GpuType;
  gpuName: string;
  vramMb: number | null;
  tier: HardwareTier;
  warning: string;
  /** Recommended packages and frameworks for this hardware. */
  recommendedPackages: string[];
  /** Whether code generation should be adapted for this hardware. */
  adaptCodeGeneration: boolean;
}

// =============================================================
// Sentinel Watchdog Types (from AutoResearchClaw)
// =============================================================

export type SentinelAlertType = "nan_inf_detected" | "evidence_mismatch" | "citation_fabrication" | "quality_degradation" | "budget_exceeded";

export interface SentinelAlert {
  alertType: SentinelAlertType;
  severity: "info" | "warning" | "critical";
  message: string;
  nodeId?: string;
  artifactId?: string;
  details: Record<string, unknown>;
  detectedAt: string;
}

export interface SentinelReport {
  sessionId: string;
  alerts: SentinelAlert[];
  overallHealth: "healthy" | "degraded" | "critical";
  checksRun: number;
  checksFailed: number;
  recommendations: string[];
}
