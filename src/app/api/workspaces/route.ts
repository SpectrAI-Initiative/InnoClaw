import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { pathExists, isDirectory, addWorkspaceRoot } from "@/lib/files/filesystem";
import { requireAuth, HEADLESS_ADMIN_ID } from "@/lib/auth/server";
import { ownedWorkspaceFilter } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const allWorkspaces = await db
      .select()
      .from(workspaces)
      .where(auth.user.id === HEADLESS_ADMIN_ID ? undefined : ownedWorkspaceFilter(auth))
      .orderBy(desc(workspaces.lastOpenedAt));

    return NextResponse.json(allWorkspaces);
  } catch (error) {
    return jsonException(error, "Failed to list workspaces");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const body = await request.json();
    const { name, folderPath, isGitRepo, gitRemoteUrl } = body;

    if (!name || !folderPath) {
      return jsonError("Missing name or folderPath", 400);
    }

    // Register as workspace root so subsequent file-system calls are allowed
    addWorkspaceRoot(folderPath);

    // Check that the folder exists
    if (!(await pathExists(folderPath)) || !(await isDirectory(folderPath))) {
      return jsonError("Folder does not exist or is not a directory", 400);
    }

    // Check if a workspace already exists for this folder
    const existing = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.folderPath, folderPath))
      .limit(1);

    const ownedExisting = existing.find((workspace) => workspace.ownerUserId === auth.user.id);
    if (ownedExisting) {
      // Reopen existing workspace
      await db
        .update(workspaces)
        .set({ lastOpenedAt: new Date().toISOString() })
        .where(eq(workspaces.id, ownedExisting.id));

      return NextResponse.json(ownedExisting);
    }

    if (existing.length > 0) {
      const existingOwner = existing[0].ownerUserId;
      if (existingOwner && existingOwner !== auth.user.id) {
        return jsonError("This folder is already registered to another account", 409);
      }
      if (!existingOwner && auth.user.id === HEADLESS_ADMIN_ID) {
        await db
          .update(workspaces)
          .set({ lastOpenedAt: new Date().toISOString() })
          .where(eq(workspaces.id, existing[0].id));
        return NextResponse.json(existing[0]);
      }
      if (!existingOwner && auth.user.role === "admin") {
        await db
          .update(workspaces)
          .set({ ownerUserId: auth.user.id, lastOpenedAt: new Date().toISOString() })
          .where(eq(workspaces.id, existing[0].id));
        return NextResponse.json(existing[0]);
      }
    }

    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(workspaces).values({
      id,
      ownerUserId: auth.user.id === HEADLESS_ADMIN_ID ? null : auth.user.id,
      name,
      folderPath,
      isGitRepo: isGitRepo || false,
      gitRemoteUrl: gitRemoteUrl || null,
      lastOpenedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);

    return NextResponse.json(workspace[0], { status: 201 });
  } catch (error) {
    return jsonException(error, "Failed to create workspace");
  }
}
