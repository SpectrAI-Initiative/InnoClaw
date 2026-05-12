// =============================================================
// Deep Research — Status / Identity / Artifact unions
// =============================================================

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

export type ConfirmationOutcome =
  | "confirmed"
  | "revision_requested"
  | "branch_requested"
  | "rejected"
  | "stopped";
