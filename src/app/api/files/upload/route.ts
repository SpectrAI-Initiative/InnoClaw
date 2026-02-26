import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/files/filesystem";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const targetDir = formData.get("targetDir") as string | null;

    if (!file || !targetDir) {
      return NextResponse.json(
        { error: "Missing file or targetDir" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(targetDir, file.name);

    await uploadFile(filePath, buffer);
    return NextResponse.json({ success: true, path: filePath });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload file";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
