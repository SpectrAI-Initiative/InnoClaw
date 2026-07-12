import { NextRequest, NextResponse } from "next/server";
import { createDirectory } from "@/lib/files/filesystem";
import { requireWorkspaceProvisioningPathsAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const { path: dirPath } = await request.json();

    if (!dirPath) {
      return jsonError("Missing path", 400);
    }

    const access = await requireWorkspaceProvisioningPathsAccess(request, [
      dirPath,
    ]);
    if (access instanceof NextResponse) {
      return access;
    }

    await createDirectory(access.canonicalPaths[0]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to create directory");
  }
}
