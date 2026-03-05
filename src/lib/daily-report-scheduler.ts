/**
 * Server-side daily report scheduler.
 *
 * Uses setTimeout chain to fire at midnight and generate daily reports
 * for all workspaces. Initialized once from instrumentation.ts.
 *
 * Uses globalThis singleton pattern (same as Feishu WSClient) to survive HMR.
 */

const globalForScheduler = globalThis as unknown as {
  __dailyReportSchedulerStarted?: boolean;
};

/**
 * Calculate milliseconds until the next midnight (00:00:00).
 */
function msUntilNextMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

/**
 * Start the daily report scheduler.
 *
 * At midnight (00:00 of day N+1), generates reports for yesterday (day N).
 */
export function startDailyReportScheduler(): void {
  if (globalForScheduler.__dailyReportSchedulerStarted) {
    console.log("[daily-report-scheduler] Already started, skipping");
    return;
  }
  globalForScheduler.__dailyReportSchedulerStarted = true;
  console.log("[daily-report-scheduler] Scheduler started");

  function scheduleNextRun() {
    const ms = msUntilNextMidnight();
    console.log(
      `[daily-report-scheduler] Next run in ${Math.round(ms / 1000 / 60)} minutes`
    );

    const timer = setTimeout(async () => {
      console.log("[daily-report-scheduler] Midnight trigger fired");
      try {
        const { generateAllDailyReports } = await import(
          "@/lib/daily-report"
        );
        // At local midnight of day N+1, generate report for the previous UTC day
        const utcYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const pad = (n: number) => String(n).padStart(2, "0");
        const dateStr = `${utcYesterday.getUTCFullYear()}-${pad(utcYesterday.getUTCMonth() + 1)}-${pad(utcYesterday.getUTCDate())}`;
        await generateAllDailyReports(dateStr);
      } catch (err) {
        console.error("[daily-report-scheduler] Error:", err);
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
