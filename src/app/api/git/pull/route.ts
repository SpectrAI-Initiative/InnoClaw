import { NextRequest, NextResponse } from "next/server";
import { pullRepo } from "@/lib/git/github";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await request.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing workspaceId" },
        { status: 400 }
      );
    }

    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (workspace.length === 0) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (!workspace[0].isGitRepo) {
      return NextResponse.json(
        { error: "Workspace is not a git repository" },
        { status: 400 }
      );
    }

    const output = await pullRepo(workspace[0].folderPath);

    return NextResponse.json({ success: true, output });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to pull";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
