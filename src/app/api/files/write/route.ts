import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "@/lib/files/filesystem";
import { requirePathAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const { path: filePath, content } = await request.json();

    if (!filePath || content === undefined) {
      return jsonError("Missing path or content", 400);
    }

    const access = await requirePathAccess(request, filePath);
    if (access instanceof NextResponse) {
      return access;
    }

    await writeFile(filePath, content);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to write file");
  }
}
