import { NextRequest, NextResponse } from "next/server";
import { cloneRepo } from "@/lib/git/github";
import { pathExists } from "@/lib/files/filesystem";
import { db } from "@/lib/db";
import { isSqliteUniqueConstraint } from "@/lib/db/errors";
import { workspaces } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import path from "path";
import { requireAuth } from "@/lib/auth/server";
import {
  getOwnerUserIdForWrite,
  requireWorkspaceProvisioningPathsAccess,
} from "@/lib/auth/ownership";
import { ensureEffectiveWorkspaceRoots } from "@/lib/auth/workspace-roots";
import { jsonError, jsonException } from "@/lib/api-errors";

function deriveFolderName(repoUrl: string): string {
  const withoutQuery = repoUrl
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/[\\/]+$/, "");
  const finalSegment = withoutQuery.split(/[\\/]/).pop() || "";
  return finalSegment.replace(/\.git$/i, "") || "repo";
}

function safeFolderName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const folderName = value.trim();
  if (
    !folderName ||
    folderName === "." ||
    folderName === ".." ||
    folderName.includes("/") ||
    folderName.includes("\\") ||
    folderName.includes("\0")
  ) {
    return null;
  }
  return folderName;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoUrl, targetFolderName } = body;

    if (typeof repoUrl !== "string" || !repoUrl.trim()) {
      return jsonError("Missing repoUrl", 400);
    }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const suppliedFolderName = Object.prototype.hasOwnProperty.call(
      body,
      "targetFolderName",
    );
    const folderName = safeFolderName(
      suppliedFolderName ? targetFolderName : deriveFolderName(repoUrl),
    );
    if (!folderName) {
      return jsonError("Invalid target folder name", 400);
    }

    const defaultRoot = ensureEffectiveWorkspaceRoots(auth)[0];
    const targetPath = path.join(defaultRoot, folderName);
    const access = await requireWorkspaceProvisioningPathsAccess(request, [
      targetPath,
    ]);
    if (access instanceof NextResponse) {
      return access;
    }
    const canonicalTargetPath = access.canonicalPaths[0];

    // Check if target already exists
    if (await pathExists(canonicalTargetPath)) {
      return jsonError("Target folder already exists", 409);
    }

    await cloneRepo(repoUrl, canonicalTargetPath);

    // Create workspace record
    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(workspaces).values({
      id,
      ownerUserId: getOwnerUserIdForWrite(access.auth),
      name: folderName,
      folderPath: canonicalTargetPath,
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
    if (isSqliteUniqueConstraint(error)) {
      return jsonError("This folder is already registered", 409);
    }
    return jsonException(error, "Failed to clone repository");
  }
}
