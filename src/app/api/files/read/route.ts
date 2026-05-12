import { NextRequest, NextResponse } from "next/server";
import { readFile } from "@/lib/files/filesystem";
import { requirePathAccess } from "@/lib/auth/ownership";
import { jsonException, requiredSearchParam } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const filePath = requiredSearchParam(request, "path", "Missing path parameter");
    if (filePath instanceof NextResponse) {
      return filePath;
    }

    const access = await requirePathAccess(request, filePath);
    if (access instanceof NextResponse) {
      return access;
    }

    const content = await readFile(filePath);
    return NextResponse.json({ content });
  } catch (error) {
    return jsonException(error, "Failed to read file");
  }
}
