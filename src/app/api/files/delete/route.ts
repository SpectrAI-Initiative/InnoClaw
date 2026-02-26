import { NextRequest, NextResponse } from "next/server";
import { deleteFile } from "@/lib/files/filesystem";

export async function POST(request: NextRequest) {
  try {
    const { path: filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json(
        { error: "Missing path" },
        { status: 400 }
      );
    }

    await deleteFile(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
