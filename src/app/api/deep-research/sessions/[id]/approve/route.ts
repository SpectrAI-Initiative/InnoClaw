import { NextRequest, NextResponse } from "next/server";
import { appendEvent, updateNode } from "@/lib/deep-research/event-store";
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

export async function POST(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const body = await req.json();
    if (!isRecord(body) || typeof body.approved !== "boolean") {
      return NextResponse.json({ error: "Missing nodeId or approved (boolean)" }, { status: 400 });
    }
    const nodeId = parseRequiredString(body.nodeId, "Missing nodeId or approved (boolean)");
    const feedback = parseOptionalString(body.feedback, "Invalid feedback");

    const session = await requireSession(sessionId);
    if (isInterfaceOnlySession(session)) {
      await ensureInterfaceShell(session);

      await appendEvent(
        sessionId,
        body.approved ? "approval_granted" : "approval_denied",
        nodeId,
        "user",
        "user",
        undefined,
        {
          feedback,
          ignored: true,
          interfaceOnly: true,
        },
      );

      return NextResponse.json({
        success: true,
        applied: false,
        message: "Approval was recorded, but deep-research execution is disabled in interface-only mode.",
      });
    }

    if (session.status === "awaiting_user_confirmation") {
      return NextResponse.json(
        { error: "Session is awaiting user confirmation. Use /confirm endpoint instead." },
        { status: 409 },
      );
    }

    if (body.approved) {
      await updateNode(nodeId, { status: "completed" });
      await appendEvent(sessionId, "approval_granted", nodeId, "user", undefined, undefined, { feedback });

      if (!runManager.isRunning(sessionId) && ["awaiting_approval", "running", "paused"].includes(session.status)) {
        runManager.startRun(sessionId);
      }
    } else {
      await updateNode(nodeId, { status: "failed", error: feedback || "User denied approval" });
      await appendEvent(sessionId, "approval_denied", nodeId, "user", undefined, undefined, { feedback });
    }

    return NextResponse.json({ success: true, applied: true });
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to process approval");
  }
}
