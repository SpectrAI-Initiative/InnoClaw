import { describe, expect, it } from "vitest";
import {
  SCHEDULE_PRESETS,
  defaultScheduleForTaskType,
  describeScheduleError,
  getNextRunTimes,
  normalizeCronInput,
  validateSchedule,
} from "./schedule";

describe("normalizeCronInput", () => {
  it("converts full-width characters from Chinese input methods", () => {
    expect(normalizeCronInput("０ ９ ＊ ＊ １－５")).toBe("0 9 * * 1-5");
    expect(normalizeCronInput("0　9 * * 1，3")).toBe("0 9 * * 1,3");
    expect(normalizeCronInput("  */30   * * * * ")).toBe("*/30 * * * *");
  });
});

describe("validateSchedule", () => {
  it("accepts five-field expressions and macros, returning the normalised cron", () => {
    expect(validateSchedule("0 0 ＊ ＊ ＊")).toEqual({ ok: true, cron: "0 0 * * *" });
    expect(validateSchedule("@daily")).toEqual({ ok: true, cron: "@daily" });
  });

  it("explains why an expression is rejected", () => {
    expect(validateSchedule("   ")).toMatchObject({ ok: false, reason: "empty" });
    expect(validateSchedule("0 9 * *")).toMatchObject({ ok: false, reason: "fieldCount", fieldCount: 4 });
    expect(validateSchedule("0 0 9 * * *")).toMatchObject({ ok: false, reason: "fieldCount", fieldCount: 6 });
    expect(validateSchedule("每天 9 点")).toMatchObject({ ok: false, reason: "fieldCount" });
    expect(validateSchedule("61 9 * * *")).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("builds English API messages", () => {
    const r = validateSchedule("0 9 * *");
    if (r.ok) throw new Error("expected failure");
    expect(describeScheduleError(r)).toContain("expected 5 fields");
  });

  it("accepts every preset and the per-type defaults", () => {
    for (const preset of SCHEDULE_PRESETS) expect(validateSchedule(preset.cron).ok).toBe(true);
    expect(defaultScheduleForTaskType("weekly_report")).toBe("0 9 * * 1");
    expect(validateSchedule(defaultScheduleForTaskType("daily_report")).ok).toBe(true);
  });
});

describe("getNextRunTimes", () => {
  it("lists the upcoming runs in order", () => {
    const from = new Date(2026, 10, 21, 10, 0); // local time
    const runs = getNextRunTimes("0 9 * * *", 2, from);
    expect(runs.map((d) => [d.getDate(), d.getHours(), d.getMinutes()])).toEqual([
      [22, 9, 0],
      [23, 9, 0],
    ]);
  });

  it("returns nothing for an invalid schedule", () => {
    expect(getNextRunTimes("bad", 3)).toEqual([]);
  });
});
