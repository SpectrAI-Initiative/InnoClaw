import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/deep-research/event-store";
import { ensureInterfaceShell, isInterfaceOnlySession } from "@/lib/deep-research/interface-shell";
import { requireSession } from "@/lib/deep-research/api-helpers";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const session = await requireSession(sessionId);
    if (isInterfaceOnlySession(session)) {
      await ensureInterfaceShell(session);
    }
    const messages = await getMessages(sessionId);
    return NextResponse.json(messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
