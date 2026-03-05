/**
 * Task handler registry for the scheduled task system.
 *
 * Each handler receives the task metadata and performs the actual work.
 * New task types should be registered here.
 */

export interface TaskContext {
  id: string;
  name: string;
  taskType: string;
  workspaceId: string | null;
  config: string | null;
}

/**
 * Registry of task type handlers.
 * Key: task type string, Value: async handler function.
 */
export const taskHandlers: Record<
  string,
  (ctx: TaskContext) => Promise<void>
> = {
  daily_report: async (ctx) => {
    const { generateAllDailyReports, getUTCDateString } = await import(
      "@/lib/daily-report"
    );
    if (ctx.workspaceId) {
      // Workspace-specific: generate for a specific workspace
      const { generateDailyReport } = await import("@/lib/daily-report");
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dateStr = getUTCDateString(yesterday);
      await generateDailyReport(ctx.workspaceId, dateStr);
    } else {
      // Global: generate for all workspaces
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dateStr = getUTCDateString(yesterday);
      await generateAllDailyReports(dateStr);
    }
  },

  weekly_report: async (ctx) => {
    if (ctx.workspaceId) {
      const { generateWeeklyReport } = await import("@/lib/weekly-report");
      await generateWeeklyReport(ctx.workspaceId, new Date());
    } else {
      const { generateAllWeeklyReports } = await import(
        "@/lib/weekly-report"
      );
      await generateAllWeeklyReports(new Date());
    }
  },

  git_sync: async (ctx) => {
    if (!ctx.workspaceId) {
      throw new Error("git_sync requires a workspaceId");
    }
    const { pullRepo } = await import("@/lib/git/github");
    const { db } = await import("@/lib/db");
    const { workspaces } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, ctx.workspaceId))
      .limit(1);

    if (!ws || !ws.isGitRepo) {
      throw new Error("Workspace is not a git repository");
    }

    await pullRepo(ws.folderPath);
  },

  source_sync: async (ctx) => {
    if (!ctx.workspaceId) {
      throw new Error("source_sync requires a workspaceId");
    }
    const { syncWorkspace } = await import("@/lib/rag/pipeline");
    const { db } = await import("@/lib/db");
    const { workspaces } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, ctx.workspaceId))
      .limit(1);

    if (!ws) {
      throw new Error("Workspace not found");
    }

    await syncWorkspace(ctx.workspaceId, ws.folderPath);
  },

  custom: async (_ctx) => {
    // Custom tasks are a placeholder for future extensibility.
    // Users can define them but they currently only log execution.
    console.log(`[scheduler] Custom task "${_ctx.name}" executed (no-op)`);
  },
};
