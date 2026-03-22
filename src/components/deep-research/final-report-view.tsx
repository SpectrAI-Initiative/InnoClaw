"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle,
  Download,
  Loader2,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DeepResearchSession, DeepResearchArtifact } from "@/lib/deep-research/types";

interface FinalReportViewProps {
  session: DeepResearchSession;
  artifacts: DeepResearchArtifact[];
}

function extractReportText(artifact: DeepResearchArtifact): string {
  const c = artifact.content;
  return (
    (c.report as string) ||
    (c.messageToUser as string) ||
    (c.text as string) ||
    (c.content as string) ||
    ""
  );
}

export function FinalReportView({ session, artifacts }: FinalReportViewProps) {
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const finalReport = artifacts.find((a) => a.artifactType === "final_report");
  const reportText = finalReport ? extractReportText(finalReport) : "";

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
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/30 shrink-0">
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
          {savedPath ? "Saved" : "Save to Workspace"}
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

        {savedPath && (
          <span className="text-[10px] text-muted-foreground truncate flex-1 text-right">
            {savedPath}
          </span>
        )}
      </div>

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
