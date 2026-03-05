/**
 * Generic task scheduler engine.
 *
 * Reads scheduled tasks from the database and executes them
 * based on their cron schedule. Uses a polling loop with setTimeout
 * to check for tasks that need to run.
 *
 * Uses globalThis singleton pattern (same as daily/weekly schedulers)
 * to survive HMR.
 */

import { CronExpressionParser } from "cron-parser";
import { db } from "@/lib/db";
import { scheduledTasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { taskHandlers } from "@/lib/scheduler-handlers";

/** Check interval: every 60 seconds */
const CHECK_INTERVAL_MS = 60_000;

const globalForScheduler = globalThis as unknown as {
  __taskSchedulerStarted?: boolean;
};

/**
 * Calculate the next run time for a cron expression.
 * Returns a Date or null if the expression is invalid.
 */
export function getNextRunTime(cronExpression: string): Date | null {
  try {
    const expr = CronExpressionParser.parse(cronExpression);
    return expr.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Validate a cron expression.
 * Returns true if valid, false otherwise.
 */
export function isValidCron(cronExpression: string): boolean {
  try {
    CronExpressionParser.parse(cronExpression);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a task is due to run based on its cron schedule and last run time.
 */
export function isTaskDue(schedule: string, lastRunAt: string | null): boolean {
  try {
    const now = new Date();
    const opts = lastRunAt
      ? { currentDate: new Date(lastRunAt) }
      : { currentDate: new Date(now.getTime() - CHECK_INTERVAL_MS) };
    const expr = CronExpressionParser.parse(schedule, opts);
    const nextRun = expr.next().toDate();
    return nextRun <= now;
  } catch {
    return false;
  }
}

/**
 * Execute a single scheduled task.
 */
async function executeTask(task: {
  id: string;
  name: string;
  taskType: string;
  workspaceId: string | null;
  config: string | null;
}): Promise<void> {
  const handler = taskHandlers[task.taskType];
  if (!handler) {
    throw new Error(`Unknown task type: ${task.taskType}`);
  }

  // Mark task as running
  await db
    .update(scheduledTasks)
    .set({
      lastRunStatus: "running",
      lastRunAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(scheduledTasks.id, task.id));

  try {
    await handler(task);

    // Mark task as success
    await db
      .update(scheduledTasks)
      .set({
        lastRunStatus: "success",
        lastRunError: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(scheduledTasks.id, task.id));

    console.log(`[scheduler] Task "${task.name}" completed successfully`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Mark task as error
    await db
      .update(scheduledTasks)
      .set({
        lastRunStatus: "error",
        lastRunError: errorMsg,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(scheduledTasks.id, task.id));

    console.error(`[scheduler] Task "${task.name}" failed:`, errorMsg);
  }
}

/**
 * Perform a single tick: check all enabled tasks and run any that are due.
 */
async function tick(): Promise<void> {
  try {
    const tasks = await db
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.isEnabled, true),
        )
      );

    for (const task of tasks) {
      // Skip tasks that are currently running
      if (task.lastRunStatus === "running") continue;

      if (isTaskDue(task.schedule, task.lastRunAt)) {
        await executeTask(task);
      }
    }
  } catch (err) {
    console.error("[scheduler] Tick error:", err);
  }
}

/**
 * Start the generic task scheduler.
 * Polls the database every CHECK_INTERVAL_MS for due tasks.
 */
export function startTaskScheduler(): void {
  if (globalForScheduler.__taskSchedulerStarted) {
    console.log("[scheduler] Already started, skipping");
    return;
  }
  globalForScheduler.__taskSchedulerStarted = true;
  console.log("[scheduler] Task scheduler started");

  function scheduleNextTick() {
    const timer = setTimeout(async () => {
      await tick();
      scheduleNextTick();
    }, CHECK_INTERVAL_MS);

    // Allow process to exit even if timer is pending
    if (timer && typeof timer === "object" && "unref" in timer) {
      timer.unref();
    }
  }

  // Run first tick after a short delay to allow server startup to complete
  const startupTimer = setTimeout(async () => {
    await tick();
    scheduleNextTick();
  }, 5_000);

  if (startupTimer && typeof startupTimer === "object" && "unref" in startupTimer) {
    startupTimer.unref();
  }
}
