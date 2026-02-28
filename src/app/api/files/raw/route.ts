import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFileBuffer } from "@/lib/files/filesystem";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  stl: "model/stl",
  obj: "text/plain",
  ply: "application/x-ply",
  vtk: "application/x-vtk",
  vtp: "application/x-vtk",
  gltf: "model/gltf+json",
  glb: "model/gltf-binary",
  fbx: "application/octet-stream",
  dae: "model/vnd.collada+xml",
  "3ds": "application/x-3ds",
  "3mf": "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  pcd: "application/octet-stream",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json(
        { error: "Missing path parameter" },
        { status: 400 }
      );
    }

    const buffer = await readFileBuffer(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read file";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
