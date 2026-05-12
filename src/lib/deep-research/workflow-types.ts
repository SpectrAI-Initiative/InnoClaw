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
