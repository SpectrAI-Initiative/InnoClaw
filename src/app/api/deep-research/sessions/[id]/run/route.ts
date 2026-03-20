import { NextRequest, NextResponse } from "next/server";
import { runManager } from "@/lib/deep-research/run-manager";
import { getSession, updateSession, appendEvent } from "@/lib/deep-research/event-store";
import { PHASE_ORDER, type Phase } from "@/lib/deep-research/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Parse optional body for phase control
    let targetPhase: Phase | undefined;
    let action: "run" | "skip" | "rerun" | undefined;
    try {
      const body = await req.json();
      targetPhase = body.targetPhase;
      action = body.action;
    } catch {
      // No body — default behavior (backward compatible)
    }

    // Validate targetPhase if provided
    if (targetPhase && !PHASE_ORDER.includes(targetPhase)) {
      return NextResponse.json({ error: `Invalid phase: ${targetPhase}` }, { status: 400 });
    }

    // Handle skip action — advance past the target phase without running it
    if (action === "skip" && targetPhase) {
      const phaseIndex = PHASE_ORDER.indexOf(targetPhase);
      const nextPhase = PHASE_ORDER[phaseIndex + 1];
      if (!nextPhase) {
        return NextResponse.json({ error: "Cannot skip the final phase" }, { status: 400 });
      }
      await updateSession(sessionId, {
        phase: nextPhase,
        status: "awaiting_user_confirmation",
        pendingCheckpointId: null,
      });
      await appendEvent(sessionId, "phase_skipped", undefined, "user", "user");
      return NextResponse.json({ skipped: targetPhase, phase: nextPhase });
    }

    // If targetPhase provided (run/rerun/jump), allow even from halted state
    if (targetPhase) {
      if (runManager.isRunning(sessionId)) {
        return NextResponse.json({ error: "A run is already in progress" }, { status: 409 });
      }
      await updateSession(sessionId, {
        phase: targetPhase,
        status: "running",
        pendingCheckpointId: null,
        error: null,
      });
      await appendEvent(sessionId, "phase_jumped", undefined, "user", "user");
      const started = runManager.startRun(sessionId);
      return NextResponse.json({ started, running: runManager.isRunning(sessionId), phase: targetPhase });
    }

    // --- Default behavior (no body / no targetPhase) ---

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
