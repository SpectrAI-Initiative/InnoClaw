import { NextRequest, NextResponse } from "next/server";
import { getArtifact } from "@/lib/deep-research/event-store";
import { requireDeepResearchSessionAccess } from "@/lib/auth/ownership";

type RouteParams = { params: Promise<{ id: string; artifactId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: sessionId, artifactId } = await params;

  const access = await requireDeepResearchSessionAccess(req, sessionId);
  if (access instanceof NextResponse) {
    return access;
  }

  const artifact = await getArtifact(artifactId);
  if (!artifact || artifact.sessionId !== sessionId) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  return NextResponse.json(artifact);
}
