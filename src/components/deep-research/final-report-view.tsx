"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  Download,
  Loader2,
  FileText,
  Copy,
  Check,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DeepResearchSession, DeepResearchArtifact } from "@/lib/deep-research/types";
import {
  getLatestFinalReportArtifact,
  resolveFinalReportPresentation,
} from "@/lib/deep-research/final-report";

interface FinalReportViewProps {
  session: DeepResearchSession;
  artifacts: DeepResearchArtifact[];
}

export function FinalReportView({ session, artifacts }: FinalReportViewProps) {
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [latexConference, setLatexConference] = useState("neurips_2025");
  const [exportingLatex, setExportingLatex] = useState(false);
  const [compilingPdf, setCompilingPdf] = useState(false);

  const finalReport = getLatestFinalReportArtifact(artifacts);
  const { reportText, citationCoverage } = resolveFinalReportPresentation(finalReport, artifacts);

  const handleSaveToWorkspace = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/deep-research/sessions/${session.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      const data = await res.json();
      setSavedPath(data.filePath);
      toast.success(`Report saved to ${data.filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      toast.success("Report copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleExportLaTeX = async () => {
    setExportingLatex(true);
    try {
      const res = await fetch(
        `/api/deep-research/sessions/${session.id}/export/latex?conference=${latexConference}`,
        { method: "GET" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate LaTeX");
      }
      const data = await res.json();

      // Download .tex file
      const texBlob = new Blob([data.texContent], { type: "text/plain" });
      const texUrl = URL.createObjectURL(texBlob);
      const texAnchor = document.createElement("a");
      texAnchor.href = texUrl;
      texAnchor.download = `${session.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_").slice(0, 40)}_${latexConference}.tex`;
      texAnchor.click();
      URL.revokeObjectURL(texUrl);

      // Also download .bib if present
      if (data.bibContent) {
        const bibBlob = new Blob([data.bibContent], { type: "text/plain" });
        const bibUrl = URL.createObjectURL(bibBlob);
        const bibAnchor = document.createElement("a");
        bibAnchor.href = bibUrl;
        bibAnchor.download = "references.bib";
        bibAnchor.click();
        URL.revokeObjectURL(bibUrl);
      }

      toast.success(
        `LaTeX exported (${data.wordCount} words, ${data.bibEntryCount} references, ${latexConference.replace("_", " ").toUpperCase()})`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export LaTeX");
    } finally {
      setExportingLatex(false);
    }
  };

  const handleCompilePdf = async () => {
    setCompilingPdf(true);
    try {
      const res = await fetch(
        `/api/deep-research/sessions/${session.id}/export/latex/compile?conference=${latexConference}`,
        { method: "POST" },
      );

      // Check content-type: if PDF, download it; if JSON, it's an error/fallback
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/pdf")) {
        // Success — download PDF
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${session.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_").slice(0, 40)}.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
        toast.success("PDF compiled and downloaded");
      } else {
        // Server returned JSON — built-in compiler could not produce a PDF, fall back to .tex download
        const data = await res.json();

        // Download .tex file
        if (data.texContent) {
          const texBlob = new Blob([data.texContent], { type: "text/plain" });
          const texUrl = URL.createObjectURL(texBlob);
          const texAnchor = document.createElement("a");
          texAnchor.href = texUrl;
          texAnchor.download = `${session.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_").slice(0, 40)}_${latexConference}.tex`;
          texAnchor.click();
          URL.revokeObjectURL(texUrl);
        }

        // Download .bib file
        if (data.bibContent) {
          const bibBlob = new Blob([data.bibContent], { type: "text/plain" });
          const bibUrl = URL.createObjectURL(bibBlob);
          const bibAnchor = document.createElement("a");
          bibAnchor.href = bibUrl;
          bibAnchor.download = "references.bib";
          bibAnchor.click();
          URL.revokeObjectURL(bibUrl);
        }

        const hint = data.hint || "Install XeLaTeX, LuaLaTeX, or BasicTeX.";
        toast.warning(
          `LaTeX compiler could not finish — .tex + .bib downloaded. ${hint}`,
          { duration: 8000 },
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF compilation failed — download .tex and compile locally");
    } finally {
      setCompilingPdf(false);
    }
  };

  if (!finalReport) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Research Completed</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto opacity-50" />
            <p className="text-sm">No final report artifact found.</p>
            <p className="text-xs">
              Try clicking on nodes in the workflow graph to view individual artifacts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-green-50/50 dark:bg-green-950/20 shrink-0">
        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
        <span className="text-sm font-semibold flex-1 truncate">{session.title}</span>
        <Badge variant="secondary" className="text-[10px] shrink-0">
          Final Report
        </Badge>
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-2 px-4 py-2 border-b border-border/50 bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={handleSaveToWorkspace}
            disabled={saving || !!savedPath}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : savedPath ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            {savedPath ? "Saved" : "Save"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>

          <div className="w-px h-4 bg-border" />

          {/* LaTeX template selector */}
          <Select value={latexConference} onValueChange={setLatexConference}>
            <SelectTrigger className="h-7 w-[140px] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="neurips_2025">NeurIPS 2025</SelectItem>
              <SelectItem value="iclr_2026">ICLR 2026</SelectItem>
              <SelectItem value="icml_2026">ICML 2026</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="default"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={handleExportLaTeX}
            disabled={exportingLatex}
          >
            {exportingLatex ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileDown className="h-3 w-3" />
            )}
            Export LaTeX
          </Button>

          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={handleCompilePdf}
            disabled={compilingPdf}
          >
            {compilingPdf ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            Compile PDF
          </Button>

          {savedPath && (
            <span className="text-[10px] text-muted-foreground truncate flex-1 text-right">
              {savedPath}
            </span>
          )}
        </div>
      </div>

      {citationCoverage && (
        <div className="px-4 py-2 border-b border-border/50 bg-blue-50/40 dark:bg-blue-950/20">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge variant="outline" className="text-[10px]">
              Citations {citationCoverage.citedCitationCount}/{citationCoverage.availableCitationCount}
            </Badge>
            <Badge
              variant="outline"
              className={citationCoverage.meetsCoverage ? "text-green-600 border-green-300" : "text-amber-600 border-amber-300"}
            >
              Target {citationCoverage.minimumRequiredCitationCount}
            </Badge>
            <Badge
              variant="outline"
              className={citationCoverage.hasReferencesSection ? "text-green-600 border-green-300" : "text-red-600 border-red-300"}
            >
              {citationCoverage.hasReferencesSection ? "References present" : "References missing"}
            </Badge>
            {citationCoverage.revisedForCoverage && (
              <Badge variant="secondary" className="text-[10px]">
                Coverage revised
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Report content — full height, scrollable */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-5 max-w-none">
          <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-4 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-relaxed prose-li:leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportText}</ReactMarkdown>
          </article>
        </div>
      </ScrollArea>
    </div>
  );
}
