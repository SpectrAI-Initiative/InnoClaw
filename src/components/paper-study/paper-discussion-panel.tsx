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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import type { Article } from "@/lib/article-search/types";
import type { DiscussionMessage, DiscussionRoleId, DiscussionPhaseId } from "@/lib/paper-discussion/types";
import { DISCUSSION_ROLES, DISCUSSION_PHASES } from "@/lib/paper-discussion/roles";

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
}

export function PaperDiscussionPanel({ article, workspaceId }: PaperDiscussionPanelProps) {
  const t = useTranslations("paperDiscussion");
  const tPaper = useTranslations("paperStudy");
  const locale = useLocale();

  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [currentPhase, setCurrentPhase] = useState<DiscussionPhaseId | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isComplete = messages.length === DISCUSSION_PHASES.length && !isRunning;

  const startDiscussion = useCallback(async () => {
    setMessages([]);
    setError(null);
    setSaved(false);
    setIsRunning(true);
    setCurrentPhase("A");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/paper-study/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article, mode, locale }),
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
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg: DiscussionMessage = JSON.parse(trimmed);
            setMessages((prev) => [...prev, msg]);

            // Set the next expected phase
            const phaseIndex = DISCUSSION_PHASES.findIndex((p) => p.id === msg.phaseId);
            if (phaseIndex < DISCUSSION_PHASES.length - 1) {
              setCurrentPhase(DISCUSSION_PHASES[phaseIndex + 1].id);
            } else {
              setCurrentPhase(null);
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
      setCurrentPhase(null);
      abortRef.current = null;
    }
  }, [article, mode, locale]);

  const stopDiscussion = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSaveToNotes = useCallback(async () => {
    if (!workspaceId || messages.length === 0) return;

    const transcript = messages
      .map((m) => {
        const role = DISCUSSION_ROLES[m.roleId];
        const roleName = t(role.nameKey.split(".")[1] as Parameters<typeof t>[0]);
        return `### ${roleName} (Phase ${m.phaseId})\n\n${m.content}`;
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

      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      toast.success(t("savedToNotes"));
    } catch {
      toast.error("Failed to save discussion to notes");
    }
  }, [workspaceId, messages, article, t, tPaper]);

  const handleExportMarkdown = useCallback(() => {
    if (messages.length === 0) return;

    const transcript = messages
      .map((m) => {
        const role = DISCUSSION_ROLES[m.roleId];
        const roleName = t(role.nameKey.split(".")[1] as Parameters<typeof t>[0]);
        return `### ${roleName} (Phase ${m.phaseId})\n\n${m.content}`;
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
  }, [messages, article, mode, t]);

  function getRoleIcon(roleId: DiscussionRoleId) {
    const role = DISCUSSION_ROLES[roleId];
    const IconComp = ROLE_ICONS[role.icon];
    return IconComp ? <IconComp className={`h-4 w-4 ${role.color}`} /> : null;
  }

  // Empty state
  if (messages.length === 0 && !isRunning) {
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
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50 bg-muted/20 shrink-0">
        {DISCUSSION_PHASES.map((phase, i) => {
          const role = DISCUSSION_ROLES[phase.roleId];
          const isDone = messages.some((m) => m.phaseId === phase.id);
          const isCurrent = currentPhase === phase.id;

          return (
            <div key={phase.id} className="flex items-center gap-1">
              {i > 0 && <div className="w-3 h-px bg-border" />}
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
                  isCurrent
                    ? "bg-primary/10 text-primary font-medium"
                    : isDone
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                {isCurrent && <Loader2 className="h-3 w-3 animate-spin" />}
                {isDone && <Check className="h-3 w-3 text-green-600" />}
                <span className="hidden sm:inline">{phase.id}</span>
                <span className="hidden lg:inline text-[10px]">
                  {getRoleIcon(phase.roleId)}
                </span>
              </div>
            </div>
          );
        })}

        <div className="ml-auto flex items-center gap-1">
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
          {messages.map((msg, i) => {
            const role = DISCUSSION_ROLES[msg.roleId];
            const isReport = msg.phaseId === "F";

            return (
              <div
                key={`${msg.phaseId}-${i}`}
                className={`rounded-lg border p-3 ${
                  isReport
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/50 bg-background"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getRoleIcon(msg.roleId)}
                  <Badge variant="outline" className={`text-xs ${role.color}`}>
                    {t(role.nameKey.split(".")[1] as Parameters<typeof t>[0])}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Phase {msg.phaseId}
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            );
          })}

          {/* Loading indicator for current phase */}
          {isRunning && currentPhase && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border/50 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t("running")}</span>
              <span className="text-xs">
                Phase {currentPhase} — {t(DISCUSSION_PHASES.find((p) => p.id === currentPhase)!.labelKey.split(".")[1] as Parameters<typeof t>[0])}
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
