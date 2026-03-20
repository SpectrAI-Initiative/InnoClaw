import { NextRequest, NextResponse } from "next/server";
import { getNodes } from "@/lib/deep-research/event-store";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const nodes = await getNodes(sessionId);
  return NextResponse.json(nodes);
}
