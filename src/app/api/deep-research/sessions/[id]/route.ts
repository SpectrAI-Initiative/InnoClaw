import { NextRequest, NextResponse } from "next/server";
import { getSession, deleteSession } from "@/lib/deep-research/event-store";
import { runManager } from "@/lib/deep-research/run-manager";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Abort any active orchestrator run before deleting
    if (runManager.isRunning(sessionId)) {
      runManager.abortRun(sessionId);
    }

    await deleteSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
