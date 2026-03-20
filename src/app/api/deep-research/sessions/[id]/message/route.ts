import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/lib/deep-research/event-store";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const { content } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Missing or invalid content" }, { status: 400 });
    }

    const message = await addMessage(sessionId, "user", content);
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
