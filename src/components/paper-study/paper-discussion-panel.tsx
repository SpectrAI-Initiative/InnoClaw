"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Gavel,
  BookOpen,
  ShieldAlert,
  FlaskConical,
  PenTool,
  Play,
  Square,
  Save,
  Check,
  Download,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileImage,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Article } from "@/lib/article-search/types";
import type { DiscussionTurn, DiscussionRoleId, DiscussionStageId } from "@/lib/paper-discussion/types";
import { DISCUSSION_ROLES, DISCUSSION_STAGES } from "@/lib/paper-discussion/roles";

// Map icon names to components
const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Gavel,
  BookOpen,
  ShieldAlert,
  FlaskConical,
  PenTool,
};

interface PaperDiscussionPanelProps {
  article: Article;
  workspaceId?: string;
  llmProvider?: string | null;
  llmModel?: string | null;
}

export function PaperDiscussionPanel({ article, workspaceId, llmProvider, llmModel }: PaperDiscussionPanelProps) {
  const t = useTranslations("paperDiscussion");
  const tPaper = useTranslations("paperStudy");
  const locale = useLocale();

  const [turns, setTurns] = useState<DiscussionTurn[]>([]);
  const [currentStage, setCurrentStage] = useState<DiscussionStageId | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [paperPages, setPaperPages] = useState<Array<{ pageNumber: number; data: string; mimeType: string }>>([]);
  const [pagesExpanded, setPagesExpanded] = useState(false);
  const [selectedPage, setSelectedPage] = useState<{ pageNumber: number; data: string; mimeType: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isComplete = turns.length === DISCUSSION_STAGES.length && !isRunning;

  const startDiscussion = useCallback(async () => {
    setTurns([]);
    setPaperPages([]);
    setPagesExpanded(false);
    setSelectedPage(null);
    setError(null);
    setSaved(false);
    setIsRunning(true);
    setCurrentStage(DISCUSSION_STAGES[0].id);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/paper-study/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article,
          mode,
          locale,
          ...(llmProvider && llmModel ? { llmProvider, llmModel } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.type === "paper_pages") {
              setPaperPages(parsed.pages);
            } else {
              const turn = parsed as DiscussionTurn;
              setTurns((prev) => [...prev, turn]);

              // Set the next expected stage
              const stageIndex = DISCUSSION_STAGES.findIndex((s) => s.id === turn.stageId);
              if (stageIndex < DISCUSSION_STAGES.length - 1) {
                setCurrentStage(DISCUSSION_STAGES[stageIndex + 1].id);
              } else {
                setCurrentStage(null);
              }
            }
          } catch {
            // Skip malformed lines
          }
        }

        // Auto-scroll
        if (scrollRef.current) {
          const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || "Discussion failed");
      }
    } finally {
      setIsRunning(false);
      setCurrentStage(null);
      abortRef.current = null;
    }
  }, [article, mode, locale, llmProvider, llmModel]);

  const stopDiscussion = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSaveToNotes = useCallback(async () => {
    if (!workspaceId || turns.length === 0) return;

    const transcript = turns
      .map((turn) => {
        const role = DISCUSSION_ROLES[turn.roleId];
        const roleName = t(role.nameKey.split(".")[1] as Parameters<typeof t>[0]);
        return `### ${roleName} — ${turn.stageId}\n\n${turn.content}`;
      })
      .join("\n\n---\n\n");

    const title = `${tPaper("discussionNoteTitle")}: ${article.title.slice(0, 60)}`;
    const content = `# ${t("title")}: ${article.title}\n\n${transcript}`;

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title,
          content,
          type: "paper_discussion",
        }),
      });

      if (!res.ok) {
        let errorMessage: string | undefined;
        try {
          const data = await res.json();
          errorMessage =
            (typeof data === "string" ? data : data?.error || data?.message) || undefined;
        } catch {
          try {
            const text = await res.text();
            errorMessage = text || undefined;
          } catch {
            // Ignore parsing errors and fall back to localized message below.
          }
        }

        throw new Error(errorMessage || tPaper("saveDiscussionToNotesError"));
      }

      setSaved(true);
      toast.success(t("savedToNotes"));
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : tPaper("saveDiscussionToNotesError");
      toast.error(message);
    }
  }, [workspaceId, turns, article, t, tPaper]);

  const handleExportMarkdown = useCallback(() => {
    if (turns.length === 0) return;

    const transcript = turns
      .map((turn) => {
        const role = DISCUSSION_ROLES[turn.roleId];
        const roleName = t(role.nameKey.split(".")[1] as Parameters<typeof t>[0]);
        return `### ${roleName} — ${turn.stageId}\n\n${turn.content}`;
      })
      .join("\n\n---\n\n");

    const md = `# Paper Discussion: ${article.title}\n\n**Authors:** ${article.authors.join(", ")}\n**Mode:** ${mode}\n**Date:** ${new Date().toISOString().slice(0, 10)}\n\n---\n\n${transcript}`;

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paper-discussion-${article.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [turns, article, mode, t]);

  function getRoleIcon(roleId: DiscussionRoleId) {
    const role = DISCUSSION_ROLES[roleId];
    const IconComp = ROLE_ICONS[role.icon];
    return IconComp ? <IconComp className={`h-4 w-4 ${role.color}`} /> : null;
  }

  // Empty state
  if (turns.length === 0 && !isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("noDiscussion")}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border">
            <button
              className={`px-3 py-1.5 text-xs rounded-l-md transition-colors ${mode === "quick" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setMode("quick")}
            >
              {t("modeQuick")}
            </button>
            <button
              className={`px-3 py-1.5 text-xs rounded-r-md transition-colors ${mode === "full" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setMode("full")}
            >
              {t("modeFull")}
            </button>
          </div>
          <Button onClick={startDiscussion} size="sm" className="gap-1.5">
            <Play className="h-3.5 w-3.5" />
            {t("startDiscussion")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress stepper */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50 bg-muted/20 shrink-0 overflow-x-auto">
        {DISCUSSION_STAGES.map((stage, i) => {
          const doneTurn = turns.find((turn) => turn.stageId === stage.id);
          const isDone = !!doneTurn;
          const isError = doneTurn?.error === true;
          const isCurrent = currentStage === stage.id;

          return (
            <div key={stage.id} className="flex items-center gap-1">
              {i > 0 && <div className="w-3 h-px bg-border shrink-0" />}
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors whitespace-nowrap ${
                  isCurrent
                    ? "bg-primary/10 text-primary font-medium"
                    : isError
                      ? "text-destructive"
                      : isDone
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                }`}
              >
                {isCurrent && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                {isDone && !isError && <Check className="h-3 w-3 text-green-600 shrink-0" />}
                {isError && <AlertCircle className="h-3 w-3 text-destructive shrink-0" />}
                {getRoleIcon(stage.roleId)}
                <span className="hidden lg:inline">
                  {t(stage.labelKey.split(".")[1] as Parameters<typeof t>[0])}
                </span>
              </div>
            </div>
          );
        })}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {isRunning && (
            <Button variant="ghost" size="sm" onClick={stopDiscussion} className="h-6 px-2 text-xs gap-1">
              <Square className="h-3 w-3" />
              {t("stopDiscussion")}
            </Button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="p-3 space-y-4">
          {/* Paper Pages Gallery */}
          {paperPages.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-muted/10">
              <button
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setPagesExpanded((v) => !v)}
              >
                <FileImage className="h-3.5 w-3.5" />
                <span>Paper Pages ({paperPages.length})</span>
                {pagesExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
              </button>
              {pagesExpanded && (
                <div className="flex gap-2 px-3 pb-3 overflow-x-auto">
                  {paperPages.map((page) => (
                    <button
                      key={page.pageNumber}
                      className="flex-shrink-0 flex flex-col items-center gap-1 group"
                      onClick={() => setSelectedPage(page)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:${page.mimeType};base64,${page.data}`}
                        alt={`Page ${page.pageNumber}`}
                        className="h-32 w-auto rounded border border-border/50 shadow-sm group-hover:border-primary/50 transition-colors"
                      />
                      <span className="text-[10px] text-muted-foreground">Page {page.pageNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Full-size page dialog */}
          <Dialog open={!!selectedPage} onOpenChange={(open) => !open && setSelectedPage(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
              <DialogTitle>Page {selectedPage?.pageNumber}</DialogTitle>
              {selectedPage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:${selectedPage.mimeType};base64,${selectedPage.data}`}
                  alt={`Page ${selectedPage.pageNumber}`}
                  className="w-full h-auto rounded"
                />
              )}
            </DialogContent>
          </Dialog>

          {turns.map((turn, i) => {
            const role = DISCUSSION_ROLES[turn.roleId];
            const isReport = turn.stageId === "final_report";
            const isError = turn.error === true;

            return (
              <div
                key={`${turn.stageId}-${i}`}
                className={`rounded-lg border p-3 ${
                  isError
                    ? "border-destructive/50 bg-destructive/5"
                    : isReport
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/50 bg-background"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isError ? <AlertCircle className="h-4 w-4 text-destructive" /> : getRoleIcon(turn.roleId)}
                  <Badge variant="outline" className={`text-xs ${isError ? "text-destructive border-destructive/50" : role.color}`}>
                    {t(role.nameKey.split(".")[1] as Parameters<typeof t>[0])}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t(DISCUSSION_STAGES.find((s) => s.id === turn.stageId)?.labelKey.split(".")[1] as Parameters<typeof t>[0])}
                  </span>
                </div>
                <div className={`prose prose-sm dark:prose-invert max-w-none text-sm ${isError ? "text-destructive" : ""}`}>
                  <ReactMarkdown>{turn.content}</ReactMarkdown>
                </div>
              </div>
            );
          })}

          {/* Loading indicator for current stage */}
          {isRunning && currentStage && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border/50 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t("running")}</span>
              <span className="text-xs">
                {t(DISCUSSION_STAGES.find((s) => s.id === currentStage)!.labelKey.split(".")[1] as Parameters<typeof t>[0])}
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Action bar */}
      {isComplete && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 shrink-0">
          <span className="text-xs text-muted-foreground">{t("completed")}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleExportMarkdown}
            >
              <Download className="h-3 w-3" />
              {t("exportMarkdown")}
            </Button>
            {workspaceId && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleSaveToNotes}
                disabled={saved}
              >
                {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                {saved ? t("savedToNotes") : t("saveToNotes")}
              </Button>
            )}
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={startDiscussion}
            >
              <Play className="h-3 w-3" />
              {t("startDiscussion")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
