import { NextRequest, NextResponse } from "next/server";
import { renameFile } from "@/lib/files/filesystem";
import { requireWorkspacePathsAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const { sourcePath, destPath } = await request.json();

    if (!sourcePath || !destPath || typeof sourcePath !== "string" || typeof destPath !== "string") {
      return jsonError("sourcePath and destPath must be non-empty strings", 400);
    }

    const access = await requireWorkspacePathsAccess(request, [sourcePath, destPath]);
    if (access instanceof NextResponse) {
      return access;
    }

    await renameFile(sourcePath, destPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to move");
  }
}
