"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, Check, Square, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { NoteDiscussionDialog } from "./note-discussion-dialog";

/** Sanitize a string for use as a filename. */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w\u4e00-\u9fff\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

interface PaperSummarySectionProps {
  summary: string;
  isSummarizing: boolean;
  workspaceId: string;
  notesDir?: string;
  onSaved?: () => void;
  onStop?: () => void;
}

export function PaperSummarySection({
  summary,
  isSummarizing,
  workspaceId,
  notesDir,
  onSaved,
  onStop,
}: PaperSummarySectionProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [discussOpen, setDiscussOpen] = useState(false);

  if (!isSummarizing && !summary) return null;

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const noteTitle = `${t("summaryNoteTitle")} - ${dateStr}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: noteTitle,
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

  const handleSaveToFile = async () => {
    if (!notesDir) return;
    setSavingFile(true);
    try {
      const fileName = `${sanitizeFileName(t("summaryNoteTitle"))}-${dateStr}.md`;
      const filePath = `${notesDir}/${fileName}`;
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: `# ${noteTitle}\n\n${summary}` }),
      });
      if (!res.ok) throw new Error("Write failed");
      setSavedFilePath(filePath);
      toast.success(t("savedToFile"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSavingFile(false);
    }
  };

  return (
    <div className="border-t p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          {isSummarizing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("summaryTitle")}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
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
            <>
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
              {notesDir && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleSaveToFile}
                  disabled={savingFile || !!savedFilePath}
                  className="gap-1 text-xs"
                >
                  {savedFilePath ? (
                    <Check className="h-3 w-3" />
                  ) : savingFile ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {savedFilePath ? t("savedToFile") : t("saveToFile")}
                </Button>
              )}
              {savedFilePath && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setDiscussOpen(true)}
                  className="gap-1 text-xs"
                >
                  <MessageSquare className="h-3 w-3" />
                  {t("expandDiscuss")}
                </Button>
              )}
            </>
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

      {/* Discussion dialog */}
      <NoteDiscussionDialog
        open={discussOpen}
        onClose={() => setDiscussOpen(false)}
        noteTitle={noteTitle}
        noteContent={summary}
        noteFilePath={savedFilePath || undefined}
      />
    </div>
  );
}
