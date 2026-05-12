import { NextRequest, NextResponse } from "next/server";
import { getArtifacts } from "@/lib/deep-research/event-store";
import type { ArtifactType } from "@/lib/deep-research/types";
import { ensureInterfaceShell, isInterfaceOnlySession } from "@/lib/deep-research/interface-shell";
import { requireSession } from "@/lib/deep-research/api-helpers";
import { requireDeepResearchSessionAccess } from "@/lib/auth/ownership";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const access = await requireDeepResearchSessionAccess(req, sessionId);
  if (access instanceof NextResponse) {
    return access;
  }
  const session = await requireSession(sessionId);
  if (isInterfaceOnlySession(session)) {
    await ensureInterfaceShell(session);
  }
  const nodeId = req.nextUrl.searchParams.get("nodeId") ?? undefined;
  const type = req.nextUrl.searchParams.get("type") as ArtifactType | undefined;

  const artifacts = await getArtifacts(sessionId, { nodeId, type: type || undefined });
  return NextResponse.json(artifacts);
}
