/**
 * Cron schedule helpers shared by the scheduled-task form and API routes.
 *
 * Users kept failing to create tasks: the example cron was only a placeholder
 * (the field stayed empty), Chinese input methods produce full-width "＊" and
 * "，", and errors came back as English "Invalid cron expression". These
 * helpers normalise common input mistakes, explain what is wrong, and preview
 * the next run times. Safe to import in client components.
 */
import { CronExpressionParser } from "cron-parser";

export interface SchedulePreset {
  id: string;
  cron: string;
}

/** Common schedules offered in the form (labels live in i18n `scheduledTasks.presets.<id>`). */
export const SCHEDULE_PRESETS: SchedulePreset[] = [
  { id: "daily9", cron: "0 9 * * *" },
  { id: "dailyMidnight", cron: "0 0 * * *" },
  { id: "weekdays9", cron: "0 9 * * 1-5" },
  { id: "weeklyMon9", cron: "0 9 * * 1" },
  { id: "hourly", cron: "0 * * * *" },
  { id: "every30min", cron: "*/30 * * * *" },
];

/** Sensible default schedule for a newly created task of each type. */
export function defaultScheduleForTaskType(taskType: string): string {
  return taskType === "weekly_report" ? "0 9 * * 1" : "0 9 * * *";
}

const MACROS = new Set(["@yearly", "@annually", "@monthly", "@weekly", "@daily", "@hourly"]);

/** Convert full-width characters from CJK input methods and collapse whitespace. */
export function normalizeCronInput(input: string): string {
  return input
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[　 ]/g, " ")
    .replace(/[、]/g, ",")
    .trim()
    .replace(/\s+/g, " ");
}

export type ScheduleValidation =
  | { ok: true; cron: string }
  | { ok: false; cron: string; reason: "empty" | "fieldCount" | "invalid"; fieldCount?: number };

/**
 * Validate a (normalised) cron expression. Requires exactly five fields
 * (minute hour day month weekday) or a macro such as `@daily`; cron-parser on
 * its own also accepts 4- or 6-field forms and even an empty string ("every
 * minute"), which is never what the user meant here.
 */
export function validateSchedule(input: string): ScheduleValidation {
  const cron = normalizeCronInput(input);
  if (!cron) return { ok: false, cron, reason: "empty" };
  if (!MACROS.has(cron.toLowerCase())) {
    const fieldCount = cron.split(" ").length;
    if (fieldCount !== 5) return { ok: false, cron, reason: "fieldCount", fieldCount };
  }
  try {
    CronExpressionParser.parse(cron);
    return { ok: true, cron };
  } catch {
    return { ok: false, cron, reason: "invalid" };
  }
}

/** Next `count` run times for a valid schedule (empty array if invalid). */
export function getNextRunTimes(input: string, count = 3, from: Date = new Date()): Date[] {
  const result = validateSchedule(input);
  if (!result.ok) return [];
  try {
    const expr = CronExpressionParser.parse(result.cron, { currentDate: from });
    return Array.from({ length: count }, () => expr.next().toDate());
  } catch {
    return [];
  }
}

/** English API error message for a failed validation (the UI shows its own localized text). */
export function describeScheduleError(result: Extract<ScheduleValidation, { ok: false }>): string {
  switch (result.reason) {
    case "empty":
      return "schedule is required";
    case "fieldCount":
      return `Invalid cron expression: expected 5 fields (minute hour day month weekday), got ${result.fieldCount}`;
    default:
      return "Invalid cron expression";
  }
}
