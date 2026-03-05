"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, Check, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface PaperSummarySectionProps {
  summary: string;
  isSummarizing: boolean;
  workspaceId: string;
  onSaved?: () => void;
  onStop?: () => void;
}

export function PaperSummarySection({
  summary,
  isSummarizing,
  workspaceId,
  onSaved,
  onStop,
}: PaperSummarySectionProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isSummarizing && !summary) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: `${t("summaryNoteTitle")} - ${dateStr}`,
          content: summary,
          type: "summary",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          {isSummarizing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("summaryTitle")}
        </h3>
        <div className="flex items-center gap-1.5">
          {isSummarizing && onStop && (
            <Button
              variant="destructive"
              size="xs"
              onClick={onStop}
              className="gap-1 text-xs"
            >
              <Square className="h-3 w-3" />
              {t("stopSummarize")}
            </Button>
          )}
          {summary && !isSummarizing && (
            <Button
              variant="outline"
              size="xs"
              onClick={handleSave}
              disabled={saving || saved}
              className="gap-1 text-xs"
            >
              {saved ? (
                <Check className="h-3 w-3" />
              ) : saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {saved ? t("savedToNotes") : t("saveToNotes")}
            </Button>
          )}
        </div>
      </div>

      {isSummarizing ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[80%]" />
          <Skeleton className="h-4 w-[85%]" />
          <Skeleton className="h-4 w-[70%]" />
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
