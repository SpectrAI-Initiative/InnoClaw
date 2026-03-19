import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { pathExists, isDirectory, addWorkspaceRoot } from "@/lib/files/filesystem";

export async function GET() {
  try {
    const allWorkspaces = await db
      .select()
      .from(workspaces)
      .orderBy(desc(workspaces.lastOpenedAt));

    return NextResponse.json(allWorkspaces);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list workspaces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, folderPath, isGitRepo, gitRemoteUrl } = body;

    if (!name || !folderPath) {
      return NextResponse.json(
        { error: "Missing name or folderPath" },
        { status: 400 }
      );
    }

    // Register as workspace root so subsequent file-system calls are allowed
    addWorkspaceRoot(folderPath);

    // Check that the folder exists
    if (!(await pathExists(folderPath)) || !(await isDirectory(folderPath))) {
      return NextResponse.json(
        { error: "Folder does not exist or is not a directory" },
        { status: 400 }
      );
    }

    // Check if a workspace already exists for this folder
    const existing = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.folderPath, folderPath))
      .limit(1);

    if (existing.length > 0) {
      // Reopen existing workspace
      await db
        .update(workspaces)
        .set({ lastOpenedAt: new Date().toISOString() })
        .where(eq(workspaces.id, existing[0].id));

      return NextResponse.json(existing[0]);
    }

    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(workspaces).values({
      id,
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
    const message =
      error instanceof Error ? error.message : "Failed to create workspace";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
