import { NextRequest, NextResponse } from "next/server";
import { runManager } from "@/lib/deep-research/run-manager";
import { getSession, updateSession } from "@/lib/deep-research/event-store";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Cannot /run if awaiting_user_confirmation — must use /confirm instead
    if (session.status === "awaiting_user_confirmation") {
      return NextResponse.json(
        { error: "Session is awaiting user confirmation. Use /confirm endpoint instead." },
        { status: 409 }
      );
    }

    // If already running in the run manager, report that
    if (runManager.isRunning(sessionId)) {
      return NextResponse.json({ started: false, running: true });
    }

    // If awaiting approval, paused, failed, or stuck in "running" without an active run, resume
    if (["awaiting_approval", "paused", "running", "failed"].includes(session.status)) {
      await updateSession(sessionId, { status: "running", error: null });
    }

    const started = runManager.startRun(sessionId);
    return NextResponse.json({ started, running: runManager.isRunning(sessionId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
