import { NextRequest, NextResponse } from "next/server";
import { getRepoInfo } from "@/lib/hf-datasets/metadata";
import type { HfRepoType } from "@/types";

/**
 * GET /api/datasets/repo-info?repoId=X&repoType=Y
 * Fetch HuggingFace repo metadata for the download dialog preview.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get("repoId");
    const repoType = (searchParams.get("repoType") || "dataset") as HfRepoType;

    if (!repoId) {
      return NextResponse.json({ error: "Missing repoId" }, { status: 400 });
    }

    const info = await getRepoInfo(repoId, repoType);
    return NextResponse.json(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch repo info";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
