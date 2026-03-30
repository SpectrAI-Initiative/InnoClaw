import { NextRequest, NextResponse } from "next/server";
import { listSessions, createSession, addMessage, getSession } from "@/lib/deep-research/event-store";
import { ensureInterfaceShell } from "@/lib/deep-research/interface-shell";
import {
  handleDeepResearchRouteError,
  parseOptionalString,
  parseRequiredString,
  parseOptionalStringArray,
} from "@/lib/deep-research/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = parseRequiredString(
      req.nextUrl.searchParams.get("workspaceId"),
      "Missing workspaceId",
    );
    const sessions = await listSessions(workspaceId);
    return NextResponse.json(sessions);
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to fetch sessions");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = parseRequiredString(body.workspaceId, "Missing workspaceId");
    const title = parseRequiredString(body.title, "Missing title");
    const content = parseOptionalString(body.content, "Invalid content");
    const files = parseOptionalStringArray(body.files, "Invalid files");

    const session = await createSession(workspaceId, title, body.config);

    // If content is provided (from text intake or uploaded file contents),
    // create the initial user message automatically.
    if (content && typeof content === "string" && content.trim()) {
      const metadata: Record<string, unknown> = {};
      if (Array.isArray(files) && files.length > 0) {
        metadata.sourceFiles = files;
        metadata.intakeMode = "upload";
      } else {
        metadata.intakeMode = "text";
      }
      await addMessage(session.id, "user", content.trim(), metadata);
    }

    if (session.config.interfaceOnly === true) {
      await ensureInterfaceShell(session);
    }
    const updatedSession = await getSession(session.id);

    return NextResponse.json(updatedSession ?? session, { status: 201 });
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to create session");
  }
}
