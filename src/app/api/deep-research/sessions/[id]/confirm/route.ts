import { NextRequest, NextResponse } from "next/server";
import type { ConfirmationOutcome } from "@/lib/deep-research/types";
import { appendEvent, updateSession } from "@/lib/deep-research/event-store";
import { ensureInterfaceShell, isInterfaceOnlySession } from "@/lib/deep-research/interface-shell";
import { runManager } from "@/lib/deep-research/run-manager";
import {
  handleDeepResearchRouteError,
  isRecord,
  parseOptionalString,
  parseRequiredString,
  readSessionId,
  requireSession,
  type DeepResearchRouteParams,
} from "@/lib/deep-research/api-helpers";

const VALID_OUTCOMES: ConfirmationOutcome[] = [
  "confirmed",
  "revision_requested",
  "branch_requested",
  "rejected",
  "stopped",
];

const EVENT_BY_OUTCOME: Record<ConfirmationOutcome, "user_confirmed" | "user_requested_revision" | "user_requested_branch" | "user_rejected_result" | "user_requested_stop"> = {
  confirmed: "user_confirmed",
  revision_requested: "user_requested_revision",
  branch_requested: "user_requested_branch",
  rejected: "user_rejected_result",
  stopped: "user_requested_stop",
};

/**
 * POST /api/deep-research/sessions/[id]/confirm
 * User confirms, requests revision, branches, rejects, or stops a checkpoint.
 */
export async function POST(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const body = await req.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Missing required fields: nodeId, outcome" },
        { status: 400 },
      );
    }
    const nodeId = parseRequiredString(body.nodeId, "Missing required fields: nodeId, outcome");
    const outcome = parseRequiredString(body.outcome, "Missing required fields: nodeId, outcome");
    const feedback = parseOptionalString(body.feedback, "Invalid feedback");

    if (!VALID_OUTCOMES.includes(outcome as ConfirmationOutcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(", ")}` },
        { status: 400 }
      );
    }

    const session = await requireSession(sessionId);
    if (isInterfaceOnlySession(session)) {
      await ensureInterfaceShell(session);
      await updateSession(sessionId, {
        status: "paused",
        contextTag: "planning",
        error: null,
      });
      await appendEvent(sessionId, EVENT_BY_OUTCOME[outcome as ConfirmationOutcome], nodeId, "user", "user", undefined, {
        outcome,
        feedback,
        ignored: true,
        interfaceOnly: true,
      });

      return NextResponse.json({
        started: false,
        running: false,
        applied: false,
        message: "Confirmation was recorded, but deep-research execution is disabled in interface-only mode.",
      });
    }

    if (session.status !== "awaiting_user_confirmation") {
      return NextResponse.json(
        { error: `Session is not awaiting confirmation (status: ${session.status})` },
        { status: 409 },
      );
    }

    const started = runManager.resumeAfterConfirmation(
      sessionId,
      nodeId,
      outcome as ConfirmationOutcome,
      feedback,
    );

    return NextResponse.json({
      started,
      running: runManager.isRunning(sessionId),
      applied: true,
    });
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to process confirmation");
  }
}
