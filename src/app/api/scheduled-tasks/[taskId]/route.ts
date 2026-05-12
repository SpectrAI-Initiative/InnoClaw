import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduledTasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isValidCron } from "@/lib/scheduler";
import { requireScheduledTaskAccess, requireWorkspaceAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

const VALID_TASK_TYPES = [
  "daily_report",
  "weekly_report",
  "git_sync",
  "source_sync",
  "custom",
] as const;

/** PATCH /api/scheduled-tasks/[taskId] — update a scheduled task */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const access = await requireScheduledTaskAccess(request, taskId);
    if (access instanceof NextResponse) {
      return access;
    }
    const { task } = access;

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return jsonError("name must be a non-empty string", 400);
      }
      updates.name = body.name.trim();
    }

    if (body.taskType !== undefined) {
      if (!VALID_TASK_TYPES.includes(body.taskType)) {
        return jsonError(`taskType must be one of: ${VALID_TASK_TYPES.join(", ")}`, 400);
      }
      updates.taskType = body.taskType;
    }

    if (body.schedule !== undefined) {
      if (typeof body.schedule !== "string" || !body.schedule.trim()) {
        return jsonError("schedule must be a non-empty string", 400);
      }
      if (!isValidCron(body.schedule)) {
        return jsonError("Invalid cron expression", 400);
      }
      updates.schedule = body.schedule.trim();
    }

    if (body.workspaceId !== undefined) {
      if (body.workspaceId) {
        const access = await requireWorkspaceAccess(request, body.workspaceId);
        if (access instanceof NextResponse) {
          return access;
        }
      }
      updates.workspaceId = body.workspaceId || null;
    }

    if (body.config !== undefined) {
      if (body.config !== null && typeof body.config === "string") {
        try {
          JSON.parse(body.config);
        } catch {
          return jsonError("config must be valid JSON", 400);
        }
      }
      updates.config =
        typeof body.config === "object" && body.config !== null
          ? JSON.stringify(body.config)
          : body.config ?? null;
    }

    if (body.isEnabled !== undefined) {
      updates.isEnabled = !!body.isEnabled;
    }

    updates.updatedAt = new Date().toISOString();

    await db
      .update(scheduledTasks)
      .set(updates)
      .where(eq(scheduledTasks.id, task.id));

    const [updated] = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, task.id))
      .limit(1);

    return NextResponse.json(updated);
  } catch (error) {
    return jsonException(error, "Failed to update scheduled task");
  }
}

/** DELETE /api/scheduled-tasks/[taskId] — delete a scheduled task */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const access = await requireScheduledTaskAccess(request, taskId);
    if (access instanceof NextResponse) {
      return access;
    }
    const { task } = access;

    await db.delete(scheduledTasks).where(eq(scheduledTasks.id, task.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to delete scheduled task");
  }
}
