import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/deep-research/event-store";
import { runManager } from "@/lib/deep-research/run-manager";
import type { ConfirmationOutcome } from "@/lib/deep-research/types";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_OUTCOMES: ConfirmationOutcome[] = [
  "confirmed",
  "revision_requested",
  "branch_requested",
  "rejected",
  "stopped",
];

/**
 * POST /api/deep-research/sessions/[id]/confirm
 * User confirms, requests revision, branches, rejects, or stops a checkpoint.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const { nodeId, outcome, feedback } = await req.json();

    if (!nodeId || !outcome) {
      return NextResponse.json(
        { error: "Missing required fields: nodeId, outcome" },
        { status: 400 }
      );
    }

    if (!VALID_OUTCOMES.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(", ")}` },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "awaiting_user_confirmation") {
      return NextResponse.json(
        { error: `Session is not awaiting confirmation (status: ${session.status})` },
        { status: 409 }
      );
    }

    // Start the resume-after-confirmation flow (runs as detached promise)
    const started = runManager.resumeAfterConfirmation(
      sessionId,
      nodeId,
      outcome as ConfirmationOutcome,
      feedback
    );

    return NextResponse.json({
      started,
      running: runManager.isRunning(sessionId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process confirmation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
