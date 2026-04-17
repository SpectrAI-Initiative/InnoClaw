import { NextRequest, NextResponse } from "next/server";
import { getSession, getArtifacts } from "@/lib/deep-research/event-store";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeFile } from "@/lib/files/filesystem";
import path from "path";
import {
  extractFinalReportTextWithFallbackReferences,
  getLatestFinalReportArtifact,
} from "@/lib/deep-research/final-report";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/deep-research/sessions/[id]/export
 * Exports the final report as a markdown file to the workspace folder.
 * Body: { filename?: string }
 * Returns: { success: true, filePath: string }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const body = await req.json().catch(() => ({}));
    const customFilename = body.filename as string | undefined;

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get workspace folder path
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, session.workspaceId));

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Find the final report artifact
    const artifacts = await getArtifacts(sessionId);
    const finalReport = getLatestFinalReportArtifact(artifacts);

    if (!finalReport) {
      return NextResponse.json({ error: "No final report found for this session" }, { status: 404 });
    }

    // Extract report text from artifact content
    const reportText = extractFinalReportTextWithFallbackReferences(finalReport, artifacts);

    // Build the full markdown document with metadata header
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const markdown = [
      `# ${session.title}`,
      "",
      `> Deep Research Report | Generated: ${now.toLocaleString()} | Session: \`${sessionId}\``,
      "",
      "---",
      "",
      reportText,
    ].join("\n");

    // Build filename
    const safeName = session.title
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff\s-_]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 80);
    const filename = customFilename || `${safeName}_${dateStr}.md`;
    const reportsDir = path.join(workspace.folderPath, "deep-research-reports");
    const filePath = path.join(reportsDir, filename);

    await writeFile(filePath, markdown);

    return NextResponse.json({
      success: true,
      filePath,
      filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
