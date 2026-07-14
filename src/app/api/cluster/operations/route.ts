import { NextRequest, NextResponse } from "next/server";
import { listClusterOps } from "@/lib/cluster/operations";
import { requireWorkspaceAccess } from "@/lib/auth/ownership";
import { canUseHighRiskExecution } from "@/lib/auth/privileges";
import { forbiddenResponse, requireAuth } from "@/lib/auth/server";

/**
 * GET /api/cluster/operations?workspaceId=xxx&limit=50&offset=0
 *
 * Returns the agent's cluster operation history for display in the
 * cluster dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") ?? undefined;
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 50, 1),
      200
    );
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    if (workspaceId) {
      const access = await requireWorkspaceAccess(request, workspaceId);
      if (access instanceof NextResponse) {
        return access;
      }
    } else if (!canUseHighRiskExecution(auth)) {
      return forbiddenResponse("High-risk execution access required");
    }

    const ops = await listClusterOps({ workspaceId, limit, offset });
    return NextResponse.json(ops);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
