// =============================================================
// Ideation Stage IDs (deterministic 5-stage pipeline)
// =============================================================
export type IdeationStageId =
  | "hypothesis_generation"
  | "feasibility_review"
  | "experiment_design"
  | "review"
  | "final_report";

// =============================================================
// Ideation Role IDs
// =============================================================
export type IdeationRoleId =
  | "ideator"
  | "feasibility_checker"
  | "experimentalist"
  | "reviewer"
  | "scribe";

// =============================================================
// Stage definition — maps each stage to its owning role
// =============================================================
export interface IdeationStage {
  id: IdeationStageId;
  roleId: IdeationRoleId;
  labelKey: string;
}

// =============================================================
// Agent config — reusable role definition
// =============================================================
export interface IdeationAgentConfig {
  roleId: IdeationRoleId;
  displayName: string;
  systemPrompt: string;
  stageParticipation: IdeationStageId[];
  icon: string;
  color: string;
}

// =============================================================
// Ideation turn — one agent's output for one stage
// =============================================================
export interface IdeationTurn {
  stageId: IdeationStageId;
  roleId: IdeationRoleId;
  content: string;
  timestamp: string;
}

// =============================================================
// Shared context available to all agents during ideation
// =============================================================
export interface IdeationSharedContext {
  article: {
    id: string;
    title: string;
    authors: string[];
    abstract: string;
    publishedDate: string;
    source: string;
  };
  userSeed?: string;
  retrievedEvidence?: string;
  locale: string;
  mode: "quick" | "full";
}

// =============================================================
// Full session state for a research ideation session
// =============================================================
export interface IdeationSessionState {
  id: string;
  context: IdeationSharedContext;
  stages: IdeationStage[];
  currentStageIndex: number;
  transcript: IdeationTurn[];
  report: IdeationReport | null;
  status: "idle" | "running" | "completed" | "error";
  error?: string;
}

// =============================================================
// Feasibility assessment for a hypothesis
// =============================================================
export interface FeasibilityAssessment {
  dataAvailability: string;
  computeRequirements: string;
  methodologicalReadiness: string;
  timeline: string;
  risk: string;
}

// =============================================================
// Final structured report (Scribe output schema)
// =============================================================
export interface IdeationReport {
  paperSnapshot: {
    title: string;
    mainProblem: string;
    claimedContribution: string;
  };
  hypotheses: Array<{
    id: string;
    title: string;
    rationale: string;
    novelty: string;
    feasibility: FeasibilityAssessment;
  }>;
  experimentPlans: Array<{
    hypothesisId: string;
    protocol: string;
    controls: string[];
    metrics: string[];
    expectedOutcome: string;
    minimumViableExperiment: string;
  }>;
  reviewFindings: {
    logicalGaps: string[];
    ethicalConcerns: string[];
    statisticalIssues: string[];
    missedBaselines: string[];
    scopeAssessment: string;
  };
  recommendedActions: {
    immediateNextSteps: string[];
    longTermDirections: string[];
    collaborationOpportunities: string[];
  };
  overallAssessment: string;
}

// =============================================================
// UI-facing role metadata (icon/color/i18n)
// =============================================================
export interface IdeationRole {
  id: IdeationRoleId;
  nameKey: string;
  icon: string;
  color: string;
}
