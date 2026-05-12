import { NextRequest, NextResponse } from "next/server";
import { listDirectory, addWorkspaceRoot } from "@/lib/files/filesystem";
import { requirePathAccess } from "@/lib/auth/ownership";
import { jsonException, requiredSearchParam } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const dirPath = requiredSearchParam(request, "path", "Missing path parameter");
    if (dirPath instanceof NextResponse) {
      return dirPath;
    }

    const access = await requirePathAccess(request, dirPath);
    if (access instanceof NextResponse) {
      return access;
    }

    // Auto-register as workspace root if not already covered
    addWorkspaceRoot(dirPath);

    const entries = await listDirectory(dirPath);
    return NextResponse.json(entries);
  } catch (error) {
    return jsonException(error, "Failed to browse directory");
  }
}
