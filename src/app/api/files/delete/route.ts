import { NextRequest, NextResponse } from "next/server";
import { deleteFile } from "@/lib/files/filesystem";
import { requirePathAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const { path: filePath } = await request.json();

    if (!filePath) {
      return jsonError("Missing path", 400);
    }

    const access = await requirePathAccess(request, filePath);
    if (access instanceof NextResponse) {
      return access;
    }

    await deleteFile(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to delete");
  }
}
