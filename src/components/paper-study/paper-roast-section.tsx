"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, Check, Square, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import type { Article } from "@/lib/article-search/types";
import type { Components } from "react-markdown";
import { NoteDiscussionDialog } from "./note-discussion-dialog";

/** Sanitize a string for use as a filename. */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w\u4e00-\u9fff\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

interface PaperRoastSectionProps {
  roast: string;
  isRoasting: boolean;
  workspaceId: string;
  notesDir?: string;
  articles?: Article[];
  onArticleSelect?: (article: Article) => void;
  onSaved?: () => void;
  onStop?: () => void;
}

export function PaperRoastSection({
  roast,
  isRoasting,
  workspaceId,
  notesDir,
  articles = [],
  onArticleSelect,
  onSaved,
  onStop,
}: PaperRoastSectionProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingNoteFor, setSavingNoteFor] = useState<string | null>(null);
  const [savedNoteFor, setSavedNoteFor] = useState<Set<string>>(new Set());

  // File save state
  const [savingFile, setSavingFile] = useState(false);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [savingFileFor, setSavingFileFor] = useState<string | null>(null);
  const [savedFileFor, setSavedFileFor] = useState<Map<string, string>>(new Map());

  // Discussion dialog state
  const [discussOpen, setDiscussOpen] = useState(false);
  const [discussTitle, setDiscussTitle] = useState("");
  const [discussContent, setDiscussContent] = useState("");
  const [discussFilePath, setDiscussFilePath] = useState<string | undefined>();

  /**
   * Parse roast text to extract per-paper sections.
   * Sections start with ### 📄 {title}
   */
  const paperSections = useMemo(() => {
    if (!roast) return new Map<string, string>();
    const sections = new Map<string, string>();
    const lines = roast.split("\n");
    let currentTitle = "";
    let currentLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/^###\s*📄\s*(.+)/);
      if (match) {
        if (currentTitle) {
          sections.set(currentTitle.toLowerCase().trim(), currentLines.join("\n"));
        }
        currentTitle = match[1];
        currentLines = [line];
      } else if (currentTitle) {
        currentLines.push(line);
      }
    }
    if (currentTitle) {
      sections.set(currentTitle.toLowerCase().trim(), currentLines.join("\n"));
    }
    return sections;
  }, [roast]);

  if (!isRoasting && !roast) return null;

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: `🔪 今日锐评 - ${dateStr}`,
          content: roast,
          type: "summary",
        }),
      });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveToFile = async () => {
    if (!notesDir) return;
    setSavingFile(true);
    try {
      const fileName = `锐评-${dateStr}.md`;
      const filePath = `${notesDir}/${fileName}`;
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: `# 🔪 今日锐评 - ${dateStr}\n\n${roast}` }),
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

  /** Find matching article by comparing title text. */
  const findArticleByTitle = (titleText: string): Article | undefined => {
    if (!articles.length) return undefined;
    const clean = titleText.replace(/^📄\s*/, "").trim().toLowerCase();
    return articles.find((a) => {
      const aTitle = a.title.toLowerCase().trim();
      return aTitle === clean || clean.includes(aTitle) || aTitle.includes(clean);
    });
  };

  /** Save a single paper's roast section as a note (DB). */
  const handleSaveNoteForPaper = async (article: Article, sectionContent: string) => {
    const key = `${article.source}-${article.id}`;
    setSavingNoteFor(key);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: `🔪 锐评: ${article.title} - ${dateStr}`,
          content: sectionContent,
          type: "summary",
        }),
      });
      setSavedNoteFor((prev) => new Set(prev).add(key));
      setTimeout(() => {
        setSavedNoteFor((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 3000);
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setSavingNoteFor(null);
    }
  };

  /** Save a single paper's roast section as a file. */
  const handleSaveFileForPaper = async (article: Article, sectionContent: string) => {
    if (!notesDir) return;
    const key = `${article.source}-${article.id}`;
    setSavingFileFor(key);
    try {
      const fileName = `锐评-${sanitizeFileName(article.title)}-${dateStr}.md`;
      const filePath = `${notesDir}/${fileName}`;
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: `# 🔪 锐评: ${article.title}\n\n${sectionContent}` }),
      });
      if (!res.ok) throw new Error("Write failed");
      setSavedFileFor((prev) => new Map(prev).set(key, filePath));
      toast.success(t("savedToFile"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setSavingFileFor(null);
    }
  };

  /** Open discussion dialog for a per-paper review. */
  const openDiscussForPaper = (article: Article, sectionContent: string) => {
    const key = `${article.source}-${article.id}`;
    setDiscussTitle(`锐评: ${article.title}`);
    setDiscussContent(sectionContent);
    setDiscussFilePath(savedFileFor.get(key));
    setDiscussOpen(true);
  };

  /** Get section content for an article. */
  const getSectionForArticle = (article: Article): string => {
    const titleLower = article.title.toLowerCase().trim();
    for (const [key, content] of paperSections) {
      if (key.includes(titleLower) || titleLower.includes(key)) {
        return content;
      }
    }
    return "";
  };

  /** Custom h3 renderer that adds action buttons for paper review sections. */
  const markdownComponents: Components = {
    h3: ({ children, ...props }) => {
      const text = String(children ?? "");
      if (!text.startsWith("📄")) {
        return <h3 {...props}>{children}</h3>;
      }

      const article = findArticleByTitle(text);

      return (
        <div className="not-prose">
          <div className="flex items-center justify-between gap-2 mt-4 mb-2 pb-1.5 border-b border-border/50">
            <h3 className="text-sm font-bold m-0" {...props}>{children}</h3>
            {article && (
              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                {onArticleSelect && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="gap-1 text-xs h-6"
                    onClick={() => onArticleSelect(article)}
                  >
                    <MessageSquare className="h-3 w-3" />
                    {t("roastDiscuss")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  className="gap-1 text-xs h-6"
                  disabled={
                    savingNoteFor === `${article.source}-${article.id}` ||
                    savedNoteFor.has(`${article.source}-${article.id}`)
                  }
                  onClick={() => {
                    const section = getSectionForArticle(article);
                    if (section) handleSaveNoteForPaper(article, section);
                  }}
                >
                  {savedNoteFor.has(`${article.source}-${article.id}`) ? (
                    <Check className="h-3 w-3" />
                  ) : savingNoteFor === `${article.source}-${article.id}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {savedNoteFor.has(`${article.source}-${article.id}`)
                    ? t("imported")
                    : t("roastSaveNote")}
                </Button>
                {notesDir && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="gap-1 text-xs h-6"
                    disabled={
                      savingFileFor === `${article.source}-${article.id}` ||
                      savedFileFor.has(`${article.source}-${article.id}`)
                    }
                    onClick={() => {
                      const section = getSectionForArticle(article);
                      if (section) handleSaveFileForPaper(article, section);
                    }}
                  >
                    {savedFileFor.has(`${article.source}-${article.id}`) ? (
                      <Check className="h-3 w-3" />
                    ) : savingFileFor === `${article.source}-${article.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    {savedFileFor.has(`${article.source}-${article.id}`)
                      ? t("savedToFile")
                      : t("saveToFile")}
                  </Button>
                )}
                {savedFileFor.has(`${article.source}-${article.id}`) && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="gap-1 text-xs h-6"
                    onClick={() => {
                      const section = getSectionForArticle(article);
                      if (section) openDiscussForPaper(article, section);
                    }}
                  >
                    <MessageSquare className="h-3 w-3" />
                    {t("expandDiscuss")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    },
  };

  return (
    <div className="border-t p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          {isRoasting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("roastTitle")}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isRoasting && onStop && (
            <Button
              variant="destructive"
              size="xs"
              onClick={onStop}
              className="gap-1 text-xs"
            >
              <Square className="h-3 w-3" />
              {t("stopRoast")}
            </Button>
          )}
          {roast && !isRoasting && (
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
                {saved ? t("roastSavedToNotes") : t("saveToNotes")}
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
                  onClick={() => {
                    setDiscussTitle(`今日锐评 - ${dateStr}`);
                    setDiscussContent(roast);
                    setDiscussFilePath(savedFilePath);
                    setDiscussOpen(true);
                  }}
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

      {isRoasting ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[80%]" />
          <Skeleton className="h-4 w-[85%]" />
          <Skeleton className="h-4 w-[70%]" />
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown components={markdownComponents}>{roast}</ReactMarkdown>
        </div>
      )}

      {/* Discussion dialog */}
      <NoteDiscussionDialog
        open={discussOpen}
        onClose={() => setDiscussOpen(false)}
        noteTitle={discussTitle}
        noteContent={discussContent}
        noteFilePath={discussFilePath}
      />
    </div>
  );
}
