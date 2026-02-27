import { NextRequest, NextResponse } from "next/server";
import { renameFile } from "@/lib/files/filesystem";

export async function POST(request: NextRequest) {
  try {
    const { sourcePath, destPath } = await request.json();

    if (!sourcePath || !destPath || typeof sourcePath !== "string" || typeof destPath !== "string") {
      return NextResponse.json(
        { error: "sourcePath and destPath must be non-empty strings" },
        { status: 400 }
      );
    }

    await renameFile(sourcePath, destPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to move";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
