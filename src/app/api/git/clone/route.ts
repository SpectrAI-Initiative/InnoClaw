import { NextRequest, NextResponse } from "next/server";
import { cloneRepo } from "@/lib/git/github";
import { getWorkspaceRoots, pathExists } from "@/lib/files/filesystem";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { repoUrl, targetFolderName } = await request.json();

    if (!repoUrl) {
      return NextResponse.json(
        { error: "Missing repoUrl" },
        { status: 400 }
      );
    }

    const roots = getWorkspaceRoots();
    if (roots.length === 0) {
      return NextResponse.json(
        { error: "No workspace roots configured" },
        { status: 400 }
      );
    }

    // Use the first workspace root as the clone target
    const defaultRoot = roots[0];

    // Derive folder name from repo URL if not provided
    const folderName =
      targetFolderName ||
      repoUrl
        .replace(/\.git$/, "")
        .split("/")
        .pop() ||
      "repo";

    const targetPath = path.join(defaultRoot, folderName);

    // Check if target already exists
    if (await pathExists(targetPath)) {
      return NextResponse.json(
        { error: "Target folder already exists" },
        { status: 400 }
      );
    }

    await cloneRepo(repoUrl, targetPath);

    // Create workspace record
    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(workspaces).values({
      id,
      name: folderName,
      folderPath: targetPath.replace(/\\/g, "/"),
      isGitRepo: true,
      gitRemoteUrl: repoUrl,
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
      error instanceof Error ? error.message : "Failed to clone repository";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
