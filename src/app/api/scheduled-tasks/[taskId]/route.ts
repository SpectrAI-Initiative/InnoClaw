import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduledTasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isValidCron } from "@/lib/scheduler";

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

    const existing = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, taskId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json(
          { error: "name must be a non-empty string" },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.taskType !== undefined) {
      if (!VALID_TASK_TYPES.includes(body.taskType)) {
        return NextResponse.json(
          { error: `taskType must be one of: ${VALID_TASK_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.taskType = body.taskType;
    }

    if (body.schedule !== undefined) {
      if (typeof body.schedule !== "string" || !body.schedule.trim()) {
        return NextResponse.json(
          { error: "schedule must be a non-empty string" },
          { status: 400 }
        );
      }
      if (!isValidCron(body.schedule)) {
        return NextResponse.json(
          { error: "Invalid cron expression" },
          { status: 400 }
        );
      }
      updates.schedule = body.schedule.trim();
    }

    if (body.workspaceId !== undefined) {
      updates.workspaceId = body.workspaceId || null;
    }

    if (body.config !== undefined) {
      if (body.config !== null && typeof body.config === "string") {
        try {
          JSON.parse(body.config);
        } catch {
          return NextResponse.json(
            { error: "config must be valid JSON" },
            { status: 400 }
          );
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
      .where(eq(scheduledTasks.id, taskId));

    const [updated] = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, taskId))
      .limit(1);

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update scheduled task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/scheduled-tasks/[taskId] — delete a scheduled task */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    const existing = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, taskId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await db.delete(scheduledTasks).where(eq(scheduledTasks.id, taskId));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete scheduled task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
