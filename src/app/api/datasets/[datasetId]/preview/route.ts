import { NextRequest, NextResponse } from "next/server";
import { previewItems } from "@/lib/hf-datasets/preview";
import { requireDatasetAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * GET /api/datasets/[datasetId]/preview?split=train&n=20
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const access = await requireDatasetAccess(request, datasetId);
    if (access instanceof NextResponse) {
      return access;
    }

    const { searchParams } = new URL(request.url);
    const split = searchParams.get("split") || "default";
    const parsedN = parseInt(searchParams.get("n") || "20", 10);
    const n = Number.isNaN(parsedN) ? 20 : Math.max(1, Math.min(parsedN, 1000));

    const dataset = access.dataset;

    if (dataset.status !== "ready") {
      return jsonError("Dataset is not ready for preview", 400);
    }

    if (!dataset.localPath) {
      return jsonError("Dataset has no local path", 400);
    }

    const result = await previewItems(dataset.localPath, split, n);
    return NextResponse.json({ split, ...result });
  } catch (error) {
    return jsonException(error, "Failed to preview dataset");
  }
}
