import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { remoteProfiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  const profiles = await db
    .select()
    .from(remoteProfiles)
    .where(eq(remoteProfiles.workspaceId, workspaceId));

  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, name, host, port, username, remotePath, schedulerType, sshKeyRef, pollIntervalSeconds } = body;

    if (!workspaceId || !name || !host || !username || !remotePath) {
      return NextResponse.json(
        { error: "Missing required fields: workspaceId, name, host, username, remotePath" },
        { status: 400 },
      );
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    await db.insert(remoteProfiles).values({
      id,
      workspaceId,
      name,
      host,
      port: port ?? 22,
      username,
      remotePath,
      schedulerType: schedulerType ?? "shell",
      sshKeyRef: sshKeyRef ?? null,
      pollIntervalSeconds: pollIntervalSeconds ?? 60,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(remoteProfiles)
      .where(eq(remoteProfiles.id, id));

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");

  if (!id || !workspaceId) {
    return NextResponse.json({ error: "Missing id or workspaceId" }, { status: 400 });
  }

  await db
    .delete(remoteProfiles)
    .where(and(eq(remoteProfiles.id, id), eq(remoteProfiles.workspaceId, workspaceId)));

  return NextResponse.json({ success: true });
}
