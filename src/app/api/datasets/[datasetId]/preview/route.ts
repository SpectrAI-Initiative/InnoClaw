import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { previewItems } from "@/lib/hf-datasets/preview";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * GET /api/datasets/[datasetId]/preview?split=train&n=20
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const { searchParams } = new URL(request.url);
    const split = searchParams.get("split") || "default";
    const parsedN = parseInt(searchParams.get("n") || "20", 10);
    const n = Number.isNaN(parsedN) ? 20 : Math.max(1, Math.min(parsedN, 1000));

    const rows = await db
      .select()
      .from(hfDatasets)
      .where(eq(hfDatasets.id, datasetId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const dataset = rows[0];

    if (dataset.status !== "ready") {
      return NextResponse.json(
        { error: "Dataset is not ready for preview" },
        { status: 400 }
      );
    }

    if (!dataset.localPath) {
      return NextResponse.json(
        { error: "Dataset has no local path" },
        { status: 400 }
      );
    }

    const result = await previewItems(dataset.localPath, split, n);
    return NextResponse.json({ split, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview dataset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
