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
import { buildLaTeXPaper, getDefaultLaTeXTemplate, listAvailableTemplates } from "@/lib/deep-research/latex-paper-server";
import { requireDeepResearchSessionAccess } from "@/lib/auth/ownership";
import type { ConferenceName } from "@/lib/deep-research/latex-paper-server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const access = await requireDeepResearchSessionAccess(req, sessionId);
    if (access instanceof NextResponse) {
      return access;
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const artifacts = await getArtifacts(sessionId);
    const finalReport = getLatestFinalReportArtifact(artifacts);
    if (!finalReport) {
      return NextResponse.json({ error: "No final report found" }, { status: 404 });
    }

    const reportText = extractFinalReportTextWithFallbackReferences(finalReport, artifacts);

    const { searchParams } = new URL(req.url);
    const conference = (searchParams.get("conference") as ConferenceName) || undefined;

    const result = buildLaTeXPaper({
      markdownReport: reportText,
      artifacts,
      conference,
      title: session.title,
    });

    return NextResponse.json({
      texContent: result.texContent,
      bibContent: result.bibContent,
      title: result.title,
      abstract: result.abstract,
      conference: result.conference,
      wordCount: result.wordCount,
      bibEntryCount: result.bibEntries.length,
      figureCount: result.figures.length,
      tableCount: result.tables.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate LaTeX";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/deep-research/sessions/[id]/export/latex
 * Exports the final report as LaTeX (.tex) and BibTeX (.bib) files to the workspace.
 * Body: { conference?: string, filename?: string }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const access = await requireDeepResearchSessionAccess(req, sessionId);
    if (access instanceof NextResponse) {
      return access;
    }

    const body = await req.json().catch(() => ({}));
    const conference = (body.conference as ConferenceName) || undefined;
    const customFilename = body.filename as string | undefined;

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, session.workspaceId));
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const artifacts = await getArtifacts(sessionId);
    const finalReport = getLatestFinalReportArtifact(artifacts);
    if (!finalReport) {
      return NextResponse.json({ error: "No final report found" }, { status: 404 });
    }

    const reportText = extractFinalReportTextWithFallbackReferences(finalReport, artifacts);

    const result = buildLaTeXPaper({
      markdownReport: reportText,
      artifacts,
      conference,
      title: session.title,
    });

    const dateStr = new Date().toISOString().split("T")[0];
    const safeName = session.title
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff\s-_]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60);
    const baseName = customFilename || `${safeName}_${dateStr}`;
    const reportsDir = path.join(workspace.folderPath, "deep-research-reports");
    const texFilename = `${baseName}.tex`;
    const bibFilename = `${baseName}.bib`;

    const texPath = path.join(reportsDir, texFilename);
    const bibPath = path.join(reportsDir, bibFilename);

    await writeFile(texPath, result.texContent);
    await writeFile(bibPath, result.bibContent);

    return NextResponse.json({
      success: true,
      texPath,
      bibPath,
      texFilename,
      bibFilename,
      conference: result.conference,
      wordCount: result.wordCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export LaTeX";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/deep-research/sessions/[id]/export/latex/templates
 * Lists available LaTeX conference templates.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  // Using PUT as a workaround for nested route; returns available templates
  return NextResponse.json({
    templates: listAvailableTemplates(),
  });
}
