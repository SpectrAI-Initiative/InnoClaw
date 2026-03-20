import { NextRequest, NextResponse } from "next/server";
import { updateNode, appendEvent, getSession } from "@/lib/deep-research/event-store";
import { runManager } from "@/lib/deep-research/run-manager";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const { nodeId, approved, feedback } = await req.json();

    if (!nodeId || typeof approved !== "boolean") {
      return NextResponse.json(
        { error: "Missing nodeId or approved (boolean)" },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Only allow approval when session is in awaiting_approval status.
    // Do NOT start runs if session is awaiting_user_confirmation (step-gate).
    if (session.status === "awaiting_user_confirmation") {
      return NextResponse.json(
        { error: "Session is awaiting user confirmation. Use /confirm endpoint instead." },
        { status: 409 }
      );
    }

    if (approved) {
      await updateNode(nodeId, { status: "completed" });
      await appendEvent(sessionId, "approval_granted", nodeId, "user", undefined, undefined, { feedback });

      // Resume orchestrator only if session is in an appropriate state
      if (
        !runManager.isRunning(sessionId) &&
        ["awaiting_approval", "running", "paused"].includes(session.status)
      ) {
        runManager.startRun(sessionId);
      }
    } else {
      await updateNode(nodeId, { status: "failed", error: feedback || "User denied approval" });
      await appendEvent(sessionId, "approval_denied", nodeId, "user", undefined, undefined, { feedback });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process approval";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
