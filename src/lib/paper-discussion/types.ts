import type { PaperContentPart } from "@/lib/files/pdf-image-extractor";

// =============================================================
// Discussion Stage IDs (deterministic 6-stage loop)
// =============================================================
export type DiscussionStageId =
  | "agenda"
  | "evidence_summary"
  | "critique"
  | "reproducibility_check"
  | "convergence"
  | "final_report";

// =============================================================
// Discussion Role IDs
// =============================================================
export type DiscussionRoleId =
  | "moderator"
  | "librarian"
  | "skeptic"
  | "reproducer"
  | "scribe";

// =============================================================
// Stage definition — maps each stage to its owning role
// =============================================================
export interface DiscussionStage {
  id: DiscussionStageId;
  roleId: DiscussionRoleId;
  labelKey: string;
}

// =============================================================
// Agent config — reusable role definition for future discussion modes
// =============================================================
export interface DiscussionAgentConfig {
  roleId: DiscussionRoleId;
  displayName: string;
  systemPrompt: string;
  stageParticipation: DiscussionStageId[];
  icon: string;
  color: string;
}

// =============================================================
// Discussion turn — one agent's output for one stage
// =============================================================
export interface DiscussionTurn {
  stageId: DiscussionStageId;
  roleId: DiscussionRoleId;
  content: string;
  timestamp: string;
  error?: boolean;
}

// =============================================================
// Shared context available to all agents during the discussion
// =============================================================
export interface PaperDiscussionSharedContext {
  article: {
    id: string;
    title: string;
    authors: string[];
    abstract: string;
    publishedDate: string;
    source: string;
  };
  retrievedEvidence?: string;
  /** Structured paper content with interleaved text + page images */
  paperContent?: PaperContentPart[];
  /** Whether the current model supports vision/image inputs */
  supportsVision?: boolean;
  /** Extracted figure metadata (URLs, captions) */
  figures?: Array<{ url: string; caption: string; figureId?: string }>;
  locale: string;
  mode: "quick" | "full";
}

// =============================================================
// Full session state for a paper discussion
// =============================================================
export interface PaperDiscussionSessionState {
  id: string;
  context: PaperDiscussionSharedContext;
  stages: DiscussionStage[];
  currentStageIndex: number;
  transcript: DiscussionTurn[];
  report: PaperDiscussionReport | null;
  status: "idle" | "running" | "completed" | "error";
  error?: string;
}

// =============================================================
// Final structured report (Scribe output schema)
// =============================================================
export interface PaperDiscussionReport {
  paperSnapshot: {
    title: string;
    mainProblem: string;
    claimedContribution: string;
  };
  keyClaims: string[];
  strengths: string[];
  weaknessesAndRisks: string[];
  reproducibilityAssessment: {
    status: string;
    specified: string[];
    missing: string[];
  };
  openQuestions: string[];
  recommendedActions: {
    readNext: string[];
    verifyExperimentally: string[];
    askAuthors: string[];
    worthFollowUp: string;
  };
  overallTake: string;
}

// =============================================================
// Backward-compatible aliases for existing UI code
// =============================================================
/** @deprecated Use DiscussionStageId */
export type DiscussionPhaseId = DiscussionStageId;
/** @deprecated Use DiscussionTurn */
export type DiscussionMessage = DiscussionTurn;

// UI-facing role metadata (icon/color/i18n)
export interface DiscussionRole {
  id: DiscussionRoleId;
  nameKey: string;
  icon: string;
  color: string;
}

export interface DiscussionPhase {
  id: DiscussionStageId;
  roleId: DiscussionRoleId;
  labelKey: string;
}
