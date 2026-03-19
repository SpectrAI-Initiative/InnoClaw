import { NextRequest, NextResponse } from "next/server";
import { listDirectory, addWorkspaceRoot } from "@/lib/files/filesystem";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dirPath = searchParams.get("path");

    if (!dirPath) {
      return NextResponse.json(
        { error: "Missing path parameter" },
        { status: 400 }
      );
    }

    // Auto-register as workspace root if not already covered
    addWorkspaceRoot(dirPath);

    const entries = await listDirectory(dirPath);
    return NextResponse.json(entries);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to browse directory";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
