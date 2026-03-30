import type { NodeStatus, SessionStatus } from "./types";

function createStatusSet<T extends string>(values: readonly T[]): ReadonlySet<T> {
  return new Set(values);
}

export const ACTIVE_SESSION_STATUSES = createStatusSet<SessionStatus>([
  "running",
  "reviewing",
  "awaiting_resource",
  "literature_in_progress",
  "planning_in_progress",
  "execution_in_progress",
  "validation_planning_in_progress",
]);

export const AWAITING_CONFIRMATION_SESSION_STATUSES = createStatusSet<SessionStatus>([
  "awaiting_user_confirmation",
  "execution_prepared",
  "awaiting_additional_literature",
]);

export const COMPLETED_SESSION_STATUSES = createStatusSet<SessionStatus>([
  "completed",
  "final_report_generated",
]);

export const TERMINAL_SESSION_STATUSES = createStatusSet<SessionStatus>([
  "completed",
  "final_report_generated",
  "failed",
  "cancelled",
  "stopped_by_user",
]);

export const AUTO_ADVANCE_BLOCKED_SESSION_STATUSES = createStatusSet<SessionStatus>([
  "completed",
  "cancelled",
  "stopped_by_user",
]);

export const STARTABLE_SESSION_STATUSES = createStatusSet<SessionStatus>([
  "intake",
  "paused",
  "awaiting_approval",
  "failed",
]);

export const RUN_RESUMABLE_SESSION_STATUSES = createStatusSet<SessionStatus>([
  "awaiting_approval",
  "paused",
  "running",
  "failed",
]);

export const APPROVAL_RESUMABLE_SESSION_STATUSES = createStatusSet<SessionStatus>([
  "awaiting_approval",
  "running",
  "paused",
]);

export const RESETTABLE_NODE_STATUSES = createStatusSet<NodeStatus>([
  "failed",
  "completed",
  "skipped",
]);

export const CHECKPOINTABLE_NODE_STATUSES = createStatusSet<NodeStatus>([
  "completed",
  "failed",
  "skipped",
]);

export function isActiveSessionStatus(status: SessionStatus): boolean {
  return ACTIVE_SESSION_STATUSES.has(status);
}

export function isAwaitingConfirmationSessionStatus(status: SessionStatus): boolean {
  return AWAITING_CONFIRMATION_SESSION_STATUSES.has(status);
}

export function isCompletedSessionStatus(status: SessionStatus): boolean {
  return COMPLETED_SESSION_STATUSES.has(status);
}

export function isTerminalSessionStatus(status: SessionStatus): boolean {
  return TERMINAL_SESSION_STATUSES.has(status);
}

export function canStartSession(status: SessionStatus): boolean {
  return STARTABLE_SESSION_STATUSES.has(status);
}

export function canResumeSessionRun(status: SessionStatus): boolean {
  return RUN_RESUMABLE_SESSION_STATUSES.has(status);
}

export function canResumeSessionAfterApproval(status: SessionStatus): boolean {
  return APPROVAL_RESUMABLE_SESSION_STATUSES.has(status);
}

export function canAutoAdvanceSession(status: SessionStatus): boolean {
  return !AUTO_ADVANCE_BLOCKED_SESSION_STATUSES.has(status);
}

export function isResettableNodeStatus(status: NodeStatus): boolean {
  return RESETTABLE_NODE_STATUSES.has(status);
}

export function isCheckpointableNodeStatus(status: NodeStatus): boolean {
  return CHECKPOINTABLE_NODE_STATUSES.has(status);
}
