/**
 * Server-side weekly report scheduler.
 *
 * Uses setTimeout chain to fire every Friday at noon (12:00) and generate
 * weekly reports for all workspaces. Initialized once from instrumentation.ts.
 *
 * Uses globalThis singleton pattern to survive HMR.
 */

const globalForScheduler = globalThis as unknown as {
  __weeklyReportSchedulerStarted?: boolean;
};

/**
 * Calculate milliseconds until the next Friday at 12:00:00.
 */
function msUntilNextFridayNoon(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  // Days until next Friday
  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;

  // If today is Friday, check if noon has passed
  if (daysUntilFriday === 0) {
    const noon = new Date(now);
    noon.setHours(12, 0, 0, 0);
    if (now >= noon) {
      // Noon already passed this Friday, schedule for next Friday
      daysUntilFriday = 7;
    }
  }

  const target = new Date(now);
  target.setDate(now.getDate() + daysUntilFriday);
  target.setHours(12, 0, 0, 0);

  return target.getTime() - now.getTime();
}

/**
 * Start the weekly report scheduler.
 *
 * Fires every Friday at noon to generate weekly reports (Sat-Thu).
 */
export function startWeeklyReportScheduler(): void {
  if (globalForScheduler.__weeklyReportSchedulerStarted) {
    console.log("[weekly-report-scheduler] Already started, skipping");
    return;
  }
  globalForScheduler.__weeklyReportSchedulerStarted = true;
  console.log("[weekly-report-scheduler] Scheduler started");

  function scheduleNextRun() {
    const ms = msUntilNextFridayNoon();
    const hours = Math.round(ms / 1000 / 60 / 60);
    console.log(
      `[weekly-report-scheduler] Next run in ~${hours} hours`
    );

    const timer = setTimeout(async () => {
      console.log("[weekly-report-scheduler] Friday noon trigger fired");
      try {
        const { generateAllWeeklyReports } = await import(
          "@/lib/weekly-report"
        );
        // Generate weekly report for this week (Sat-Thu), using today (Friday) as reference
        await generateAllWeeklyReports(new Date());
      } catch (err) {
        console.error("[weekly-report-scheduler] Error:", err);
      }
      scheduleNextRun();
    }, ms);

    // Allow process to exit even if timer is pending
    if (timer && typeof timer === "object" && "unref" in timer) {
      timer.unref();
    }
  }

  scheduleNextRun();
}
