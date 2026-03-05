import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduledTasks } from "@/lib/db/schema";
import { isValidCron } from "@/lib/scheduler";
import crypto from "crypto";

const VALID_TASK_TYPES = [
  "daily_report",
  "weekly_report",
  "git_sync",
  "source_sync",
  "custom",
] as const;

/** GET /api/scheduled-tasks — list all scheduled tasks */
export async function GET() {
  try {
    const tasks = await db.select().from(scheduledTasks);
    return NextResponse.json(tasks);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list scheduled tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/scheduled-tasks — create a new scheduled task */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, taskType, schedule, workspaceId, config } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (!taskType || !VALID_TASK_TYPES.includes(taskType)) {
      return NextResponse.json(
        { error: `taskType must be one of: ${VALID_TASK_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!schedule || typeof schedule !== "string" || !schedule.trim()) {
      return NextResponse.json(
        { error: "schedule is required" },
        { status: 400 }
      );
    }

    if (!isValidCron(schedule)) {
      return NextResponse.json(
        { error: "Invalid cron expression" },
        { status: 400 }
      );
    }

    // Validate config is valid JSON if provided
    if (config !== undefined && config !== null) {
      if (typeof config === "string") {
        try {
          JSON.parse(config);
        } catch {
          return NextResponse.json(
            { error: "config must be valid JSON" },
            { status: 400 }
          );
        }
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newTask = {
      id,
      name: name.trim(),
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
    const message =
      error instanceof Error ? error.message : "Failed to create scheduled task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
