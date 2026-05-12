import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/files/filesystem";
import path from "path";
import { requirePathAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const targetDir = formData.get("targetDir") as string | null;

    if (!file || !targetDir) {
      return jsonError("Missing file or targetDir", 400);
    }

    const access = await requirePathAccess(request, targetDir);
    if (access instanceof NextResponse) {
      return access;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(targetDir, file.name);

    await uploadFile(filePath, buffer);
    return NextResponse.json({ success: true, path: filePath });
  } catch (error) {
    return jsonException(error, "Failed to upload file");
  }
}
