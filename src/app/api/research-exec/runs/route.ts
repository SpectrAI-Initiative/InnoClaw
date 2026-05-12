import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { experimentRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireWorkspaceAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException, requiredSearchParam } from "@/lib/api-errors";

export async function GET(req: NextRequest) {
  const workspaceId = requiredSearchParam(req, "workspaceId");
  if (workspaceId instanceof NextResponse) {
    return workspaceId;
  }
  const access = await requireWorkspaceAccess(req, workspaceId);
  if (access instanceof NextResponse) {
    return access;
  }

  const runs = await db
    .select()
    .from(experimentRuns)
    .where(eq(experimentRuns.workspaceId, workspaceId))
    .orderBy(desc(experimentRuns.createdAt))
    .limit(50);

  // Parse JSON columns for the client
  const parsed = runs.map((r) => ({
    ...r,
    manifest: r.manifestJson ? JSON.parse(r.manifestJson) : null,
    resultSummary: r.resultSummaryJson ? JSON.parse(r.resultSummaryJson) : null,
    recommendation: r.recommendationJson ? JSON.parse(r.recommendationJson) : null,
  }));

  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, remoteProfileId } = await req.json();

    if (!workspaceId) {
      return jsonError("Missing workspaceId", 400);
    }
    const access = await requireWorkspaceAccess(req, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    await db.insert(experimentRuns).values({
      id,
      workspaceId,
      remoteProfileId: remoteProfileId ?? null,
      status: "planning",
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(experimentRuns)
      .where(eq(experimentRuns.id, id));

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonException(error, "Failed to create run");
  }
}
