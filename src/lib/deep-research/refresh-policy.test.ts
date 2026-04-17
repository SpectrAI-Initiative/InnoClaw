import { describe, expect, it } from "vitest";
import {
  ACTIVE_DEEP_RESEARCH_REFRESH_MS,
  IDLE_DEEP_RESEARCH_REFRESH_MS,
  TERMINAL_DEEP_RESEARCH_REFRESH_MS,
  getExecutionRefreshInterval,
  getFullSessionRefreshInterval,
  getSessionRefreshInterval,
} from "./refresh-policy";

describe("refresh-policy", () => {
  it("uses active polling for non-terminal sessions", () => {
    expect(getSessionRefreshInterval({ status: "running" })).toBe(ACTIVE_DEEP_RESEARCH_REFRESH_MS);
    expect(getSessionRefreshInterval({ status: "awaiting_user_confirmation" })).toBe(ACTIVE_DEEP_RESEARCH_REFRESH_MS);
  });

  it("uses idle polling for completed-like session views", () => {
    expect(getSessionRefreshInterval({ status: "completed" })).toBe(IDLE_DEEP_RESEARCH_REFRESH_MS);
    expect(getSessionRefreshInterval({ status: "failed" })).toBe(IDLE_DEEP_RESEARCH_REFRESH_MS);
  });

  it("uses terminal polling cadence for full session data", () => {
    expect(getFullSessionRefreshInterval({ status: "completed" })).toBe(TERMINAL_DEEP_RESEARCH_REFRESH_MS);
    expect(getFullSessionRefreshInterval({ status: "awaiting_user_confirmation" })).toBe(ACTIVE_DEEP_RESEARCH_REFRESH_MS);
  });

  it("slows execution polling when all runs are terminal", () => {
    expect(getExecutionRefreshInterval([
      { status: "running" } as never,
    ])).toBe(5_000);
    expect(getExecutionRefreshInterval([
      { status: "completed" } as never,
    ])).toBe(IDLE_DEEP_RESEARCH_REFRESH_MS);
  });
});
