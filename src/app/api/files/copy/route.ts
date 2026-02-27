import { NextRequest, NextResponse } from "next/server";
import { copyFileOrDir } from "@/lib/files/filesystem";

export async function POST(request: NextRequest) {
  try {
    const { sourcePath, destPath } = await request.json();

    if (!sourcePath || !destPath || typeof sourcePath !== "string" || typeof destPath !== "string") {
      return NextResponse.json(
        { error: "sourcePath and destPath must be non-empty strings" },
        { status: 400 }
      );
    }

    await copyFileOrDir(sourcePath, destPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to copy";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
