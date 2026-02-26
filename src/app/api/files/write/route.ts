import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "@/lib/files/filesystem";

export async function POST(request: NextRequest) {
  try {
    const { path: filePath, content } = await request.json();

    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: "Missing path or content" },
        { status: 400 }
      );
    }

    await writeFile(filePath, content);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to write file";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
