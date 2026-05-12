import { NextRequest, NextResponse } from "next/server";
import { syncWorkspace } from "@/lib/rag/pipeline";
import { requireWorkspaceAccess } from "@/lib/auth/ownership";
import { jsonException } from "@/lib/api-errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const access = await requireWorkspaceAccess(request, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }

    const result = await syncWorkspace(workspaceId, access.workspace.folderPath);

    return NextResponse.json(result);
  } catch (error) {
    return jsonException(error, "Failed to sync workspace");
  }
}
