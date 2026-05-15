import { NextRequest, NextResponse } from "next/server";
import { getSession, getArtifacts } from "@/lib/deep-research/event-store";
import {
  getLatestFinalReportArtifact,
  extractFinalReportTextWithFallbackReferences,
} from "@/lib/deep-research/final-report";
import { compileLaTeXPaperToPdf } from "@/lib/deep-research/latex-compiler";
import { requireDeepResearchSessionAccess } from "@/lib/auth/ownership";
import type { ConferenceName } from "@/lib/deep-research/latex-templates";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/deep-research/sessions/[id]/export/latex/compile
 * Compiles the final report into a PDF using the built-in iterative LaTeX compiler.
 * Query: ?conference=neurips_2025
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const access = await requireDeepResearchSessionAccess(req, sessionId);
    if (access instanceof NextResponse) {
      return access;
    }

    const { searchParams } = new URL(req.url);
    const conference = (searchParams.get("conference") as ConferenceName) || undefined;

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

    const result = compileLaTeXPaperToPdf({
      markdownReport: reportText,
      artifacts,
      conference,
      title: session.title,
    });

    if (result.kind === "pdf") {
      const safeName = session.title
        .replace(/[^a-zA-Z0-9\u4e00-\u9fff\s-_]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 60);

      return new NextResponse(new Uint8Array(result.pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
          "Content-Length": String(result.pdfBuffer.length),
        },
      });
    }

    return NextResponse.json(
      {
        error: result.reason,
        hint: result.hint,
        texContent: result.paper.texContent,
        bibContent: result.paper.bibContent,
        passes: result.passes,
      },
      { status: 501 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF compilation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
