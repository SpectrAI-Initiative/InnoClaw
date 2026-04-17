import type { PersistedExecutionRecord, SessionStatus } from "./types";
import { isCompletedSessionStatus } from "./session-status";

const TERMINAL_SESSION_STATUSES = new Set<SessionStatus>([
  "completed",
  "stopped_by_user",
  "failed",
  "cancelled",
  "final_report_generated",
]);

const AWAITING_SESSION_STATUSES = new Set<SessionStatus>([
  "awaiting_user_confirmation",
  "execution_prepared",
  "awaiting_additional_literature",
]);

export const ACTIVE_DEEP_RESEARCH_REFRESH_MS = 2_000;
export const IDLE_DEEP_RESEARCH_REFRESH_MS = 30_000;
export const TERMINAL_DEEP_RESEARCH_REFRESH_MS = 60_000;

export function getSessionRefreshInterval(session: { status: SessionStatus } | null | undefined): number {
  if (!session) return ACTIVE_DEEP_RESEARCH_REFRESH_MS;
  if (
    isCompletedSessionStatus(session.status) ||
    session.status === "stopped_by_user" ||
    session.status === "failed" ||
    session.status === "cancelled"
  ) {
    return IDLE_DEEP_RESEARCH_REFRESH_MS;
  }

  return ACTIVE_DEEP_RESEARCH_REFRESH_MS;
}

export function getArtifactRefreshInterval(): number {
  return ACTIVE_DEEP_RESEARCH_REFRESH_MS;
}

export function getFullSessionRefreshInterval(session: { status: SessionStatus } | null | undefined): number {
  if (!session) return ACTIVE_DEEP_RESEARCH_REFRESH_MS;
  if (TERMINAL_SESSION_STATUSES.has(session.status)) return TERMINAL_DEEP_RESEARCH_REFRESH_MS;
  if (AWAITING_SESSION_STATUSES.has(session.status)) return ACTIVE_DEEP_RESEARCH_REFRESH_MS;
  return ACTIVE_DEEP_RESEARCH_REFRESH_MS;
}

export function getExecutionRefreshInterval(
  records: PersistedExecutionRecord[] | null | undefined,
): number {
  if (!records || records.length === 0) {
    return 5_000;
  }

  const hasActive = records.some((record) => ["pending", "submitted", "running"].includes(record.status));
  return hasActive ? 5_000 : IDLE_DEEP_RESEARCH_REFRESH_MS;
}
