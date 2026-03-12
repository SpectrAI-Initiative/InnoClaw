"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Lightbulb,
  Settings,
  FlaskConical,
  Search,
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
import type { IdeationTurn, IdeationRoleId, IdeationStageId } from "@/lib/research-ideation/types";
import { IDEATION_ROLES, IDEATION_STAGES } from "@/lib/research-ideation/roles";

// Map icon names to components
const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  Settings,
  FlaskConical,
  Search,
  PenTool,
};

interface ResearchIdeationPanelProps {
  article: Article;
  workspaceId?: string;
}

export function ResearchIdeationPanel({ article, workspaceId }: ResearchIdeationPanelProps) {
  const t = useTranslations("researchIdeation");
  const locale = useLocale();

  const [turns, setTurns] = useState<IdeationTurn[]>([]);
  const [currentStage, setCurrentStage] = useState<IdeationStageId | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [userSeed, setUserSeed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isComplete = turns.length === IDEATION_STAGES.length && !isRunning;

  const startIdeation = useCallback(async () => {
    setTurns([]);
    setError(null);
    setSaved(false);
    setIsRunning(true);
    setCurrentStage(IDEATION_STAGES[0].id);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/paper-study/ideate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article, mode, locale, userSeed: userSeed.trim() || undefined }),
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
            const turn: IdeationTurn = JSON.parse(trimmed);
            setTurns((prev) => [...prev, turn]);

            // Set the next expected stage
            const stageIndex = IDEATION_STAGES.findIndex((s) => s.id === turn.stageId);
            if (stageIndex < IDEATION_STAGES.length - 1) {
              setCurrentStage(IDEATION_STAGES[stageIndex + 1].id);
            } else {
              setCurrentStage(null);
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
        setError((err as Error).message || "Ideation failed");
      }
    } finally {
      setIsRunning(false);
      setCurrentStage(null);
      abortRef.current = null;
    }
  }, [article, mode, locale, userSeed]);

  const stopIdeation = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSaveToNotes = useCallback(async () => {
    if (!workspaceId || turns.length === 0) return;

    const transcript = turns
      .map((turn) => {
        const role = IDEATION_ROLES[turn.roleId];
        const roleName = t(role.nameKey.split(".")[1] as Parameters<typeof t>[0]);
        return `### ${roleName} — ${turn.stageId}\n\n${turn.content}`;
      })
      .join("\n\n---\n\n");

    const title = `${t("ideationNoteTitle")}: ${article.title.slice(0, 60)}`;
    const content = `# ${t("title")}: ${article.title}\n\n${transcript}`;

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title,
          content,
          type: "research_ideation",
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
            // Ignore parsing errors
          }
        }

        throw new Error(errorMessage || "Failed to save");
      }

      setSaved(true);
      toast.success(t("savedToNotes"));
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to save";
      toast.error(message);
    }
  }, [workspaceId, turns, article, t]);

  const handleExportMarkdown = useCallback(() => {
    if (turns.length === 0) return;

    const transcript = turns
      .map((turn) => {
        const role = IDEATION_ROLES[turn.roleId];
        const roleName = t(role.nameKey.split(".")[1] as Parameters<typeof t>[0]);
        return `### ${roleName} — ${turn.stageId}\n\n${turn.content}`;
      })
      .join("\n\n---\n\n");

    const md = `# Research Ideation: ${article.title}\n\n**Authors:** ${article.authors.join(", ")}\n**Mode:** ${mode}\n**Date:** ${new Date().toISOString().slice(0, 10)}${userSeed ? `\n**Seed Idea:** ${userSeed}` : ""}\n\n---\n\n${transcript}`;

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-ideation-${article.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [turns, article, mode, userSeed, t]);

  function getRoleIcon(roleId: IdeationRoleId) {
    const role = IDEATION_ROLES[roleId];
    const IconComp = ROLE_ICONS[role.icon];
    return IconComp ? <IconComp className={`h-4 w-4 ${role.color}`} /> : null;
  }

  // Empty state
  if (turns.length === 0 && !isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <Lightbulb className="h-8 w-8 text-amber-500/40" />
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("noIdeation")}
        </p>

        {/* User seed input */}
        <textarea
          value={userSeed}
          onChange={(e) => setUserSeed(e.target.value)}
          placeholder={t("userSeedPlaceholder")}
          className="w-full max-w-sm h-20 p-2 text-sm border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />

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
          <Button onClick={startIdeation} size="sm" className="gap-1.5">
            <Play className="h-3.5 w-3.5" />
            {t("startIdeation")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress stepper */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50 bg-muted/20 shrink-0 overflow-x-auto">
        {IDEATION_STAGES.map((stage, i) => {
          const isDone = turns.some((turn) => turn.stageId === stage.id);
          const isCurrent = currentStage === stage.id;

          return (
            <div key={stage.id} className="flex items-center gap-1">
              {i > 0 && <div className="w-3 h-px bg-border shrink-0" />}
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors whitespace-nowrap ${
                  isCurrent
                    ? "bg-primary/10 text-primary font-medium"
                    : isDone
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                {isCurrent && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                {isDone && <Check className="h-3 w-3 text-green-600 shrink-0" />}
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
            <Button variant="ghost" size="sm" onClick={stopIdeation} className="h-6 px-2 text-xs gap-1">
              <Square className="h-3 w-3" />
              {t("stopIdeation")}
            </Button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="p-3 space-y-4">
          {turns.map((turn, i) => {
            const role = IDEATION_ROLES[turn.roleId];
            const isReport = turn.stageId === "final_report";

            return (
              <div
                key={`${turn.stageId}-${i}`}
                className={`rounded-lg border p-3 ${
                  isReport
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/50 bg-background"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getRoleIcon(turn.roleId)}
                  <Badge variant="outline" className={`text-xs ${role.color}`}>
                    {t(role.nameKey.split(".")[1] as Parameters<typeof t>[0])}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t(IDEATION_STAGES.find((s) => s.id === turn.stageId)?.labelKey.split(".")[1] as Parameters<typeof t>[0])}
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
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
                {t(IDEATION_STAGES.find((s) => s.id === currentStage)!.labelKey.split(".")[1] as Parameters<typeof t>[0])}
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
              onClick={startIdeation}
            >
              <Play className="h-3 w-3" />
              {t("startIdeation")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
