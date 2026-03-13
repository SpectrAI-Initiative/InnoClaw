import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { experimentRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
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
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
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
    const message = error instanceof Error ? error.message : "Failed to create run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
