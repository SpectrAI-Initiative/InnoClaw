import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { remoteProfiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

  const profiles = await db
    .select()
    .from(remoteProfiles)
    .where(eq(remoteProfiles.workspaceId, workspaceId));

  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, name, host, port, username, remotePath, schedulerType, sshKeyRef, pollIntervalSeconds, rjobConfig } = body;

    if (!workspaceId || !name || !host || !username || !remotePath) {
      return jsonError("Missing required fields: workspaceId, name, host, username, remotePath", 400);
    }
    const access = await requireWorkspaceAccess(req, workspaceId);
    if (access instanceof NextResponse) {
      return access;
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
      rjobConfigJson: rjobConfig ? JSON.stringify(rjobConfig) : null,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(remoteProfiles)
      .where(eq(remoteProfiles.id, id));

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonException(error, "Failed to create profile");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, workspaceId, name, host, port, username, remotePath, schedulerType, sshKeyRef, pollIntervalSeconds, rjobConfig } = body;

    if (!id || !workspaceId) {
      return jsonError("Missing id or workspaceId", 400);
    }
    const access = await requireWorkspaceAccess(req, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };
    if (name !== undefined) updates.name = name;
    if (host !== undefined) updates.host = host;
    if (port !== undefined) updates.port = port;
    if (username !== undefined) updates.username = username;
    if (remotePath !== undefined) updates.remotePath = remotePath;
    if (schedulerType !== undefined) updates.schedulerType = schedulerType;
    if (sshKeyRef !== undefined) updates.sshKeyRef = sshKeyRef || null;
    if (pollIntervalSeconds !== undefined) updates.pollIntervalSeconds = pollIntervalSeconds;
    if (rjobConfig !== undefined) updates.rjobConfigJson = rjobConfig ? JSON.stringify(rjobConfig) : null;

    await db
      .update(remoteProfiles)
      .set(updates)
      .where(and(eq(remoteProfiles.id, id), eq(remoteProfiles.workspaceId, workspaceId)));

    const [updated] = await db
      .select()
      .from(remoteProfiles)
      .where(eq(remoteProfiles.id, id));

    return NextResponse.json(updated);
  } catch (error) {
    return jsonException(error, "Failed to update profile");
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");

  if (!id || !workspaceId) {
    return jsonError("Missing id or workspaceId", 400);
  }
  const access = await requireWorkspaceAccess(req, workspaceId);
  if (access instanceof NextResponse) {
    return access;
  }

  await db
    .delete(remoteProfiles)
    .where(and(eq(remoteProfiles.id, id), eq(remoteProfiles.workspaceId, workspaceId)));

  return NextResponse.json({ success: true });
}
