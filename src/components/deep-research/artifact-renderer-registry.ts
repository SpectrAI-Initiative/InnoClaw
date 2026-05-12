export type ArtifactRendererKind =
  | "task_board"
  | "collaboration_packet"
  | "role_specification"
  | "protocol_graph"
  | "research_brief"
  | "evidence_card"
  | "structured_summary"
  | "reviewer_packet"
  | "review_assessment"
  | "main_brain_audit"
  | "provisional_conclusion"
  | "validation_plan"
  | "execution_manifest"
  | "execution_plan"
  | "step_result"
  | "memory_profile"
  | "memory_snapshot"
  | "memory_index"
  | "final_report"
  | "task_graph"
  | "checkpoint"
  | "json";

const ARTIFACT_RENDERER_KIND_BY_TYPE: Partial<Record<string, ArtifactRendererKind>> = {
  research_brief: "research_brief",
  evidence_card: "evidence_card",
  structured_summary: "structured_summary",
  literature_round_summary: "structured_summary",
  reviewer_packet: "reviewer_packet",
  review_assessment: "review_assessment",
  main_brain_audit: "main_brain_audit",
  provisional_conclusion: "provisional_conclusion",
  validation_plan: "validation_plan",
  execution_manifest: "execution_manifest",
  execution_plan: "execution_plan",
  step_result: "step_result",
  experiment_result: "step_result",
  memory_profile: "memory_profile",
  memory_snapshot: "memory_snapshot",
  memory_index: "memory_index",
  final_report: "final_report",
  task_graph: "task_graph",
  checkpoint: "checkpoint",
};

export function resolveArtifactRendererKind(type: string, content: Record<string, unknown>): ArtifactRendererKind {
  if (looksLikeTaskBoard(content)) return "task_board";
  if (looksLikeCollaborationPacket(content)) return "collaboration_packet";
  if (looksLikeRoleSpecification(content)) return "role_specification";
  if (looksLikeProtocolGraph(content)) return "protocol_graph";

  return ARTIFACT_RENDERER_KIND_BY_TYPE[type] ?? "json";
}

export function getMarkdownArtifactText(content: Record<string, unknown>): string {
  return content.text as string
    || content.report as string
    || content.messageToUser as string
    || content.content as string
    || JSON.stringify(content, null, 2);
}

function looksLikeTaskBoard(content: Record<string, unknown>): boolean {
  return typeof content.objective === "string"
    && Array.isArray(content.assignments)
    && typeof content.coordinatorRoleId === "string";
}

function looksLikeCollaborationPacket(content: Record<string, unknown>): boolean {
  return typeof content.roleName === "string"
    && typeof content.workflowSegment === "string"
    && content.packet != null
    && typeof content.packet === "object";
}

function looksLikeRoleSpecification(content: Record<string, unknown>): boolean {
  return typeof content.roleName === "string"
    && typeof content.workflowSegment === "string"
    && Array.isArray(content.prompts)
    && Array.isArray(content.skills);
}

function looksLikeProtocolGraph(content: Record<string, unknown>): boolean {
  return Array.isArray(content.roles) && Array.isArray(content.protocols);
}
