import { NextRequest, NextResponse } from "next/server";
import { renameFile } from "@/lib/files/filesystem";

export async function POST(request: NextRequest) {
  try {
    const { oldPath, newPath } = await request.json();

    if (!oldPath || !newPath) {
      return NextResponse.json(
        { error: "Missing oldPath or newPath" },
        { status: 400 }
      );
    }

    await renameFile(oldPath, newPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to rename";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
