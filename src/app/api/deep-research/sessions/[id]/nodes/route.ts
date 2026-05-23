import { NextRequest, NextResponse } from "next/server";
import { getNodes } from "@/lib/deep-research/event-store";
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
    const nodes = await getNodes(sessionId);
    return NextResponse.json(nodes);
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to fetch nodes");
  }
}
