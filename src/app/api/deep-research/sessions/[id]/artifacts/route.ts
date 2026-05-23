import { NextRequest, NextResponse } from "next/server";
import { getArtifacts } from "@/lib/deep-research/event-store";
import type { ArtifactType } from "@/lib/deep-research/types";
import {
  handleDeepResearchRouteError,
  readSessionId,
  requireAccessibleDeepResearchSession,
  type DeepResearchRouteParams,
} from "@/lib/deep-research/api-helpers";

export async function GET(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const session = await requireAccessibleDeepResearchSession(req, sessionId);
    if (session instanceof NextResponse) {
      return session;
    }
    const nodeId = req.nextUrl.searchParams.get("nodeId") ?? undefined;
    const type = req.nextUrl.searchParams.get("type") as ArtifactType | undefined;

    const artifacts = await getArtifacts(sessionId, { nodeId, type: type || undefined });
    return NextResponse.json(artifacts);
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to fetch artifacts");
  }
}
