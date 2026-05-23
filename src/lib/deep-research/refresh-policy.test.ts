import { describe, expect, it } from "vitest";
import {
  ACTIVE_DEEP_RESEARCH_REFRESH_MS,
  IDLE_DEEP_RESEARCH_REFRESH_MS,
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
});
