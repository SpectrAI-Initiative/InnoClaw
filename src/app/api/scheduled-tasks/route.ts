import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduledTasks } from "@/lib/db/schema";
import { isValidCron } from "@/lib/scheduler";
import crypto from "crypto";
import { requireAuth } from "@/lib/auth/server";
import { requireWorkspaceAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";
import { ownedScheduledTaskFilter } from "@/lib/auth/ownership";

const VALID_TASK_TYPES = [
  "daily_report",
  "weekly_report",
  "git_sync",
  "source_sync",
  "custom",
] as const;

/** GET /api/scheduled-tasks — list all scheduled tasks */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const tasks = await db
      .select()
      .from(scheduledTasks)
      .where(ownedScheduledTaskFilter(auth));
    return NextResponse.json(tasks);
  } catch (error) {
    return jsonException(error, "Failed to list scheduled tasks");
  }
}

/** POST /api/scheduled-tasks — create a new scheduled task */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { name, taskType, schedule, workspaceId, config } = body;
    if (workspaceId) {
      const access = await requireWorkspaceAccess(request, workspaceId);
      if (access instanceof NextResponse) {
        return access;
      }
    }

    // Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return jsonError("name is required", 400);
    }

    if (!taskType || !VALID_TASK_TYPES.includes(taskType)) {
      return jsonError(`taskType must be one of: ${VALID_TASK_TYPES.join(", ")}`, 400);
    }

    if (!schedule || typeof schedule !== "string" || !schedule.trim()) {
      return jsonError("schedule is required", 400);
    }

    if (!isValidCron(schedule)) {
      return jsonError("Invalid cron expression", 400);
    }

    // Validate config is valid JSON if provided
    if (config !== undefined && config !== null) {
      if (typeof config === "string") {
        try {
          JSON.parse(config);
        } catch {
          return jsonError("config must be valid JSON", 400);
        }
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newTask = {
      id,
      name: name.trim(),
      ownerUserId: auth.user.id,
      taskType: taskType as (typeof VALID_TASK_TYPES)[number],
      schedule: schedule.trim(),
      workspaceId: workspaceId || null,
      config: typeof config === "object" && config !== null
        ? JSON.stringify(config)
        : config || null,
      isEnabled: body.isEnabled !== false,
      lastRunAt: null,
      lastRunStatus: null as "success" | "error" | "running" | null,
      lastRunError: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(scheduledTasks).values(newTask);

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    return jsonException(error, "Failed to create scheduled task");
  }
}
