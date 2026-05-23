import type { SessionStatus } from "./types";
import { isCompletedSessionStatus } from "./session-status";

export const ACTIVE_DEEP_RESEARCH_REFRESH_MS = 2_000;
export const IDLE_DEEP_RESEARCH_REFRESH_MS = 30_000;

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
