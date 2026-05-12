import type {
  ArtifactType,
  ContextTag,
  ModelRole,
  NodeType,
} from "./status-types";

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
