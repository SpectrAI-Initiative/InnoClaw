import { NextRequest, NextResponse } from "next/server";
import { renameFile } from "@/lib/files/filesystem";
import { requireWorkspacePathsAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const { oldPath, newPath } = await request.json();

    if (!oldPath || !newPath) {
      return jsonError("Missing oldPath or newPath", 400);
    }

    const access = await requireWorkspacePathsAccess(request, [oldPath, newPath]);
    if (access instanceof NextResponse) {
      return access;
    }

    await renameFile(oldPath, newPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to rename");
  }
}
