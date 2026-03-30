import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/deep-research/event-store";
import { ensureInterfaceShell, isInterfaceOnlySession } from "@/lib/deep-research/interface-shell";
import { runManager } from "@/lib/deep-research/run-manager";
import {
  handleDeepResearchRouteError,
  isRecord,
  parseOptionalString,
  readSessionId,
  requireSession,
  type DeepResearchRouteParams,
} from "@/lib/deep-research/api-helpers";

export async function POST(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const session = await requireSession(sessionId);
    if (isInterfaceOnlySession(session)) {
      await ensureInterfaceShell(session);
      await updateSession(sessionId, {
        status: "paused",
        contextTag: "planning",
        error: null,
      });

      return NextResponse.json({
        started: false,
        running: false,
        disabled: true,
        contextTag: "planning",
        message: "Deep Research execution is disabled in interface-only mode for this session.",
      });
    }

    let action: "run" | "rerun" | "skip" | undefined;
    try {
      const body = await req.json();
      if (isRecord(body)) {
        action = parseOptionalString(body.action, "Invalid action") as "run" | "rerun" | "skip" | undefined;
      }
    } catch {
      // No body provided.
    }

    if (action === "skip") {
      return NextResponse.json(
        { error: "Context-tag-based skipping is no longer supported. Researcher-controlled node dispatch is used instead." },
        { status: 400 },
      );
    }

    if (session.status === "awaiting_user_confirmation") {
      return NextResponse.json(
        { error: "Session is awaiting user confirmation. Use /confirm endpoint instead." },
        { status: 409 },
      );
    }

    if (runManager.isRunning(sessionId)) {
      return NextResponse.json({ started: false, running: true });
    }

    if (["awaiting_approval", "paused", "running", "failed"].includes(session.status)) {
      await updateSession(sessionId, { status: "running", error: null });
    }

    const started = runManager.startRun(sessionId);
    return NextResponse.json({ started, running: runManager.isRunning(sessionId) });
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to start run");
  }
}
