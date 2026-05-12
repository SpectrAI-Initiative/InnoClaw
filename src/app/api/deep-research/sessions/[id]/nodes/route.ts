import { NextRequest, NextResponse } from "next/server";
import { getNodes } from "@/lib/deep-research/event-store";
import { ensureInterfaceShell, isInterfaceOnlySession } from "@/lib/deep-research/interface-shell";
import { requireSession } from "@/lib/deep-research/api-helpers";
import { requireDeepResearchSessionAccess } from "@/lib/auth/ownership";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const access = await requireDeepResearchSessionAccess(_req, sessionId);
  if (access instanceof NextResponse) {
    return access;
  }
  const session = await requireSession(sessionId);
  if (isInterfaceOnlySession(session)) {
    await ensureInterfaceShell(session);
  }
  const nodes = await getNodes(sessionId);
  return NextResponse.json(nodes);
}
