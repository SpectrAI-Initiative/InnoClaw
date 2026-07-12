import { NextRequest, NextResponse } from "next/server";
import { listDirectory } from "@/lib/files/filesystem";
import { requireWorkspaceProvisioningPathsAccess } from "@/lib/auth/ownership";
import { jsonException, requiredSearchParam } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const dirPath = requiredSearchParam(request, "path", "Missing path parameter");
    if (dirPath instanceof NextResponse) {
      return dirPath;
    }

    const access = await requireWorkspaceProvisioningPathsAccess(request, [
      dirPath,
    ]);
    if (access instanceof NextResponse) {
      return access;
    }

    const entries = await listDirectory(access.canonicalPaths[0]);
    return NextResponse.json(entries);
  } catch (error) {
    return jsonException(error, "Failed to browse directory");
  }
}
