import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/deep-research/event-store";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const messages = await getMessages(sessionId);
    return NextResponse.json(messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
