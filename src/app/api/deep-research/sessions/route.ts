import { NextRequest, NextResponse } from "next/server";
import { listSessions, createSession, addMessage } from "@/lib/deep-research/event-store";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  const sessions = await listSessions(workspaceId);
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, title, config, content, files } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const session = await createSession(workspaceId, title, config);

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

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
