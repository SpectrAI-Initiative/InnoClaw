import { NextRequest, NextResponse } from "next/server";
import { getEvents } from "@/lib/deep-research/event-store";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const since = req.nextUrl.searchParams.get("since") ?? undefined;

  const events = await getEvents(sessionId, since);
  return NextResponse.json(events);
}
