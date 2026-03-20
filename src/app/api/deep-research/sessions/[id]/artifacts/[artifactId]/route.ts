import { NextRequest, NextResponse } from "next/server";
import { getArtifact } from "@/lib/deep-research/event-store";

type RouteParams = { params: Promise<{ id: string; artifactId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { artifactId } = await params;

  const artifact = await getArtifact(artifactId);
  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  return NextResponse.json(artifact);
}
