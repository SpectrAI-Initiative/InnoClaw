import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { experimentRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  const [run] = await db
    .select()
    .from(experimentRuns)
    .where(eq(experimentRuns.id, runId));

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...run,
    manifest: run.manifestJson ? JSON.parse(run.manifestJson) : null,
    monitoringConfig: run.monitoringConfigJson ? JSON.parse(run.monitoringConfigJson) : null,
    statusSnapshot: run.statusSnapshotJson ? JSON.parse(run.statusSnapshotJson) : null,
    lastPolledAt: run.lastPolledAt,
    collectApprovedAt: run.collectApprovedAt,
    resultSummary: run.resultSummaryJson ? JSON.parse(run.resultSummaryJson) : null,
    recommendation: run.recommendationJson ? JSON.parse(run.recommendationJson) : null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.status) updates.status = body.status;
    if (body.manifestJson !== undefined) updates.manifestJson = body.manifestJson;
    if (body.patchSummary !== undefined) updates.patchSummary = body.patchSummary;
    if (body.syncSummary !== undefined) updates.syncSummary = body.syncSummary;
    if (body.jobId !== undefined) updates.jobId = body.jobId;
    if (body.monitoringConfigJson !== undefined) updates.monitoringConfigJson = body.monitoringConfigJson;
    if (body.lastPolledAt !== undefined) updates.lastPolledAt = body.lastPolledAt;
    if (body.statusSnapshotJson !== undefined) updates.statusSnapshotJson = body.statusSnapshotJson;
    if (body.collectApprovedAt !== undefined) updates.collectApprovedAt = body.collectApprovedAt;
    if (body.resultSummaryJson !== undefined) updates.resultSummaryJson = body.resultSummaryJson;
    if (body.recommendationJson !== undefined) updates.recommendationJson = body.recommendationJson;

    await db
      .update(experimentRuns)
      .set(updates)
      .where(eq(experimentRuns.id, runId));

    const [updated] = await db
      .select()
      .from(experimentRuns)
      .where(eq(experimentRuns.id, runId));

    if (!updated) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
