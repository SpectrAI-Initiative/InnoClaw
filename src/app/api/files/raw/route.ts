import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFileBuffer } from "@/lib/files/filesystem";
import { requirePathAccess } from "@/lib/auth/ownership";
import { jsonException, requiredSearchParam } from "@/lib/api-errors";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
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
    const filePath = requiredSearchParam(request, "path", "Missing path parameter");
    if (filePath instanceof NextResponse) {
      return filePath;
    }

    const access = await requirePathAccess(request, filePath);
    if (access instanceof NextResponse) {
      return access;
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
    return jsonException(error, "Failed to read file");
  }
}
