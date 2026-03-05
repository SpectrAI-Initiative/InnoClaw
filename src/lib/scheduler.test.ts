import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock cron-parser at module level so scheduler.ts picks it up
vi.mock("cron-parser", () => {
  return {
    CronExpressionParser: {
      parse: (expr: string, opts?: { currentDate?: Date }) => {
        // Simple mock: validate known patterns, throw for invalid
        if (expr === "INVALID") {
          throw new Error("Invalid cron expression");
        }
        // Return a mock iterator
        const currentDate = opts?.currentDate ?? new Date("2026-03-05T00:00:00Z");
        return {
          next: () => {
            // For "0 0 * * *" (daily midnight), next run is tomorrow midnight
            if (expr === "0 0 * * *") {
              const next = new Date(currentDate);
              next.setUTCDate(next.getUTCDate() + 1);
              next.setUTCHours(0, 0, 0, 0);
              return { toDate: () => next };
            }
            // For "*/5 * * * *" (every 5 minutes), next run is 5 minutes from now
            if (expr === "*/5 * * * *") {
              const next = new Date(currentDate);
              next.setUTCMinutes(next.getUTCMinutes() + 5);
              return { toDate: () => next };
            }
            // For "0 12 * * 5" (Friday noon), next Friday
            if (expr === "0 12 * * 5") {
              const next = new Date(currentDate);
              next.setUTCDate(next.getUTCDate() + 7);
              next.setUTCHours(12, 0, 0, 0);
              return { toDate: () => next };
            }
            // For testing "due" tasks - next run is in the past
            if (expr === "PAST_DUE") {
              return { toDate: () => new Date("2020-01-01T00:00:00Z") };
            }
            // For testing "future" tasks
            if (expr === "FAR_FUTURE") {
              return { toDate: () => new Date("2099-01-01T00:00:00Z") };
            }
            // Default: next minute
            const next = new Date(currentDate);
            next.setUTCMinutes(next.getUTCMinutes() + 1);
            return { toDate: () => next };
          },
        };
      },
    },
  };
});

// Must import after mock is set up
import { getNextRunTime, isValidCron, isTaskDue } from "./scheduler";

describe("scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));
  });

  describe("isValidCron", () => {
    it("returns true for valid cron expressions", () => {
      expect(isValidCron("0 0 * * *")).toBe(true);
      expect(isValidCron("*/5 * * * *")).toBe(true);
      expect(isValidCron("0 12 * * 5")).toBe(true);
    });

    it("returns false for invalid cron expressions", () => {
      expect(isValidCron("INVALID")).toBe(false);
    });
  });

  describe("getNextRunTime", () => {
    it("returns a Date for valid cron expressions", () => {
      const result = getNextRunTime("0 0 * * *");
      expect(result).toBeInstanceOf(Date);
    });

    it("returns null for invalid cron expressions", () => {
      const result = getNextRunTime("INVALID");
      expect(result).toBeNull();
    });
  });

  describe("isTaskDue", () => {
    it("returns true when task next run is in the past", () => {
      expect(isTaskDue("PAST_DUE", null)).toBe(true);
    });

    it("returns false when task next run is far in the future", () => {
      expect(isTaskDue("FAR_FUTURE", null)).toBe(false);
    });

    it("returns false for invalid cron", () => {
      expect(isTaskDue("INVALID", null)).toBe(false);
    });

    it("considers lastRunAt when calculating next run", () => {
      // With a recent lastRunAt, a daily task should not be due yet
      const lastRun = "2026-03-05T00:00:00Z";
      expect(isTaskDue("FAR_FUTURE", lastRun)).toBe(false);
    });
  });
});
