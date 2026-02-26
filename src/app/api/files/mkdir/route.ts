import { NextRequest, NextResponse } from "next/server";
import { createDirectory } from "@/lib/files/filesystem";

export async function POST(request: NextRequest) {
  try {
    const { path: dirPath } = await request.json();

    if (!dirPath) {
      return NextResponse.json(
        { error: "Missing path" },
        { status: 400 }
      );
    }

    await createDirectory(dirPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create directory";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
