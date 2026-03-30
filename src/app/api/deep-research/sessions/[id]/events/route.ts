import { NextRequest, NextResponse } from "next/server";
import { getEvents } from "@/lib/deep-research/event-store";
import { ensureInterfaceShell, isInterfaceOnlySession } from "@/lib/deep-research/interface-shell";
import { requireSession } from "@/lib/deep-research/api-helpers";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const session = await requireSession(sessionId);
  if (isInterfaceOnlySession(session)) {
    await ensureInterfaceShell(session);
  }
  const since = req.nextUrl.searchParams.get("since") ?? undefined;

  const events = await getEvents(sessionId, since);
  return NextResponse.json(events);
}
