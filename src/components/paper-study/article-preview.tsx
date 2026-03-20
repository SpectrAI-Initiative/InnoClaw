"use client";

import { useState, useRef, useEffect, useMemo, useCallback, memo, type KeyboardEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ExternalLink,
  X,
  Download,
  Send,
  Loader2,
  BookOpen,
  MessageSquare,
  Save,
  Check,
  FileText,
  Link2,
  Lightbulb,
  Square,
  NotebookPen,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import type { Article } from "@/lib/article-search/types";
import type { PaperFigure } from "@/lib/paper-study/remote-paper-fetcher";
import { NoteDiscussionView } from "./note-discussion-view";
import { PaperDiscussionPanel } from "./paper-discussion-panel";
import { ResearchIdeationPanel } from "./research-ideation-panel";
import { PaperNotesPanel } from "./paper-notes-panel";

/** Route an image URL through the server-side proxy to avoid CORS issues. */
function proxyImageUrl(src: string): string {
  if (!src) return src;
  try {
    const u = new URL(src);
    if (u.hostname === "arxiv.org" || u.hostname.endsWith(".arxiv.org")) {
      return `/api/paper-study/image-proxy?url=${encodeURIComponent(src)}`;
    }
  } catch {
    // not a valid URL, return as-is
  }
  return src;
}

interface RelatedNote {
  name: string;
  reason: string;
  content: string;
}

interface ArticlePreviewProps {
  article: Article | null;
  workspaceId: string;
  onClose: () => void;
  notesDir?: string;
  onSetNotesDir?: (dir: string) => void;
  llmProvider?: string | null;
  llmModel?: string | null;
}

// --- Memoized sub-components to prevent re-renders on input change ---

interface ChatMessageItemProps {
  role: string;
  parts?: Array<{ type: string; text?: string }>;
}

const ChatMessageItem = memo(function ChatMessageItem({ role, parts }: ChatMessageItemProps) {
  const text =
    parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") || "";

  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {role === "assistant" ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        ) : (
          <span>{text}</span>
        )}
      </div>
    </div>
  );
});

interface ChatMessageListProps {
  messages: Array<{ id: string; role: string; parts?: Array<{ type: string; text?: string }> }>;
  isLoading: boolean;
  emptyText: string;
}

const ChatMessageList = memo(function ChatMessageList({ messages, isLoading, emptyText }: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground max-w-[200px]">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <ChatMessageItem key={m.id} role={m.role} parts={m.parts} />
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <div className="flex justify-start">
          <div className="rounded-lg bg-muted px-3 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
});

interface IsolatedChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  placeholder: string;
}

function IsolatedChatInput({ onSend, isLoading, placeholder }: IsolatedChatInputProps) {
  const [value, setValue] = useState("");

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || isLoading) return;
    setValue("");
    onSend(text);
  }, [value, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="border-t p-2 flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-8 text-sm"
        disabled={isLoading}
      />
      <Button
        size="icon-xs"
        onClick={handleSend}
        disabled={isLoading || !value.trim()}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

// --- Main component ---

export function ArticlePreview({
  article,
  workspaceId,
  onClose,
  notesDir = "",
  onSetNotesDir,
  llmProvider,
  llmModel,
}: ArticlePreviewProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");
  const tDisc = useTranslations("paperDiscussion");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState(article ? "detail" : "notes");
  const [savedDiscussion, setSavedDiscussion] = useState(false);
  const [savedDiscussionToNotes, setSavedDiscussionToNotes] = useState(false);
  const [isFindingRelated, setIsFindingRelated] = useState(false);
  const [relatedNotes, setRelatedNotes] = useState<RelatedNote[]>([]);

  // Quick summary state
  const [quickSummary, setQuickSummary] = useState("");
  const [summaryFigures, setSummaryFigures] = useState<PaperFigure[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);
  const summaryScrollRef = useRef<HTMLDivElement>(null);

  // Structured note generation state
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteMeta, setNoteMeta] = useState<{ methodName?: string; filePath?: string; fileName?: string } | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const noteAbortRef = useRef<AbortController | null>(null);

  // Note discussion view state
  const [showNoteDiscussion, setShowNoteDiscussion] = useState(false);
  const [discussionNote, setDiscussionNote] = useState<{
    title: string;
    content: string;
    filePath?: string;
  } | null>(null);

  // Handler for discussing an existing note from the notes panel
  const handleDiscussExistingNote = useCallback((note: { path: string; name: string; content: string }) => {
    setDiscussionNote({
      title: note.name.replace(/\.md$/, ""),
      content: note.content,
      filePath: note.path,
    });
    setShowNoteDiscussion(true);
  }, []);

  // When article changes, switch to detail tab if article is selected, or notes if cleared
  useEffect(() => {
    if (article) {
      setActiveTab("detail");
    } else {
      setActiveTab("notes");
    }
  }, [article]);

  // Reset related notes when article changes
  useEffect(() => {
    setRelatedNotes([]);
    setQuickSummary("");
    setSummaryFigures([]);
    setSummaryError(null);
    setNoteContent("");
    setNoteMeta(null);
    setNoteError(null);
    setShowNoteDiscussion(false);
    setDiscussionNote(null);
  }, [article]);

  const date = article?.publishedDate
    ? new Date(article.publishedDate).toLocaleDateString()
    : "";

  // Chat transport with article context — stable reference per article + relatedNotes
  const chatId = article
    ? `paper-chat-${article.source}-${article.id}${relatedNotes.length > 0 ? "-with-notes" : ""}`
    : "no-article";

  const transport = useMemo(
    () =>
      article
        ? new DefaultChatTransport({
            api: "/api/paper-study/chat",
            body: {
              article,
              relatedNotes: relatedNotes.length > 0 ? relatedNotes : undefined,
              ...(llmProvider && llmModel ? { llmProvider, llmModel } : {}),
            },
          })
        : new DefaultChatTransport({
            api: "/api/paper-study/chat",
            body: { article: null },
          }),
    [article, relatedNotes, llmProvider, llmModel]
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    id: chatId,
  });

  // Reset chat messages when the article changes
  useEffect(() => {
    setMessages([]);
  }, [article, setMessages]);

  const isLoading = status === "streaming" || status === "submitted";

  const handleSendMessage = useCallback((text: string) => {
    sendMessage({ text });
  }, [sendMessage]);

  const handleDownloadPdf = () => {
    if (!article) return;
    const pdfUrl =
      article.pdfUrl ||
      (article.source === "arxiv"
        ? article.url.replace("/abs/", "/pdf/")
        : null);
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  };

  // Save discussion to notes directory as .md file
  const handleSaveDiscussionToFile = async () => {
    if (messages.length === 0 || !article) return;

    if (!notesDir) {
      toast.error(t("noNotesDir"));
      return;
    }

    const userLabel = t("discussionRoleUser");
    const aiLabel = t("discussionRoleAI");
    const content = messages
      .map((m) => {
        const role = m.role === "user" ? `**${userLabel}**` : `**${aiLabel}**`;
        const text =
          m.parts
            ?.filter(
              (p): p is { type: "text"; text: string } => p.type === "text"
            )
            .map((p) => p.text)
            .join("\n") || "";
        return `${role}:\n${text}`;
      })
      .join("\n\n---\n\n");

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const sanitizedTitle = article.title
      .replace(/[/\\:*?"<>|]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60);
    const fileName = `${sanitizedTitle}-discussion-${dateStr}.md`;
    const header = `# ${t("discussionNoteTitle")}: ${article.title}\n\n**${t("publishedDate")}**: ${date}\n**${t("authors")}**: ${article.authors.join(", ")}\n\n---\n\n`;

    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: `${notesDir}/${fileName}`,
          content: header + content,
        }),
      });
      if (!res.ok) {
        toast.error(tCommon("error"));
        return;
      }
      setSavedDiscussion(true);
      toast.success(t("savedDiscussionToFile"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setTimeout(() => setSavedDiscussion(false), 3000);
    }
  };

  // Save discussion to notes database
  const handleSaveDiscussionToNotes = async () => {
    if (messages.length === 0 || !article) return;

    const userLabel = t("discussionRoleUser");
    const aiLabel = t("discussionRoleAI");
    const content = messages
      .map((m) => {
        const role = m.role === "user" ? `**${userLabel}**` : `**${aiLabel}**`;
        const text =
          m.parts
            ?.filter(
              (p): p is { type: "text"; text: string } => p.type === "text"
            )
            .map((p) => p.text)
            .join("\n") || "";
        return `${role}:\n${text}`;
      })
      .join("\n\n---\n\n");

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const title = `${t("discussionNoteTitle")}: ${article.title.slice(0, 60)}`;
    const header = `# ${t("discussionNoteTitle")}: ${article.title}\n\n**${t("publishedDate")}**: ${date}\n**${t("authors")}**: ${article.authors.join(", ")}\n**Date**: ${dateStr}\n\n---\n\n`;

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title,
          content: header + content,
          type: "paper_discussion",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || tCommon("error"));
      }

      setSavedDiscussionToNotes(true);
      toast.success(t("savedDiscussionToNotes"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setTimeout(() => setSavedDiscussionToNotes(false), 3000);
    }
  };

  // Quick summary: one-click full paper analysis
  const startQuickSummary = useCallback(async () => {
    if (!article) return;
    setQuickSummary("");
    setSummaryFigures([]);
    setSummaryError(null);
    setIsSummarizing(true);

    const controller = new AbortController();
    summaryAbortRef.current = controller;

    try {
      const res = await fetch("/api/paper-study/quick-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article,
          locale,
          ...(llmProvider && llmModel ? { llmProvider, llmModel } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 422) {
          throw new Error("no_full_text");
        }
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
            const data = JSON.parse(trimmed);
            if (data.type === "figures") {
              setSummaryFigures(data.figures || []);
            } else if (data.type === "text") {
              setQuickSummary((prev) => prev + data.text);
            }
          } catch {
            // Skip malformed lines
          }
        }

        // Auto-scroll summary area
        if (summaryScrollRef.current) {
          const viewport = summaryScrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = (err as Error).message;
        if (msg === "no_full_text") {
          setSummaryError(tDisc("noFullText"));
        } else {
          setSummaryError(msg || tDisc("summaryError"));
        }
      }
    } finally {
      setIsSummarizing(false);
      summaryAbortRef.current = null;
    }
  }, [article, locale, llmProvider, llmModel, tDisc]);

  const stopQuickSummary = useCallback(() => {
    summaryAbortRef.current?.abort();
  }, []);

  const hasSummary = quickSummary.length > 0 || isSummarizing || !!summaryError;

  // Generate structured Obsidian note
  const startGenerateNote = useCallback(async () => {
    if (!article) return;
    if (!notesDir) {
      toast.error(t("noNotesDir"));
      return;
    }

    setNoteContent("");
    setNoteMeta(null);
    setNoteError(null);
    setIsGeneratingNote(true);

    const controller = new AbortController();
    noteAbortRef.current = controller;

    try {
      const res = await fetch("/api/paper-study/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article,
          notesDir,
          ...(llmProvider && llmModel ? { llmProvider, llmModel } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 422) throw new Error("no_full_text");
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
            const data = JSON.parse(trimmed);
            if (data.type === "meta") {
              setNoteMeta({
                methodName: data.methodName,
                fileName: data.fileName,
                filePath: data.filePath,
              });
            } else if (data.type === "text") {
              setNoteContent((prev) => prev + data.text);
            } else if (data.type === "done") {
              setNoteMeta((prev) => prev ? { ...prev, filePath: data.filePath } : prev);
              toast.success(t("noteGenerated"));
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = (err as Error).message;
        if (msg === "no_full_text") {
          setNoteError(tDisc("noFullText"));
        } else {
          setNoteError(msg || t("noteGenerateError"));
        }
      }
    } finally {
      setIsGeneratingNote(false);
      noteAbortRef.current = null;
    }
  }, [article, notesDir, llmProvider, llmModel, t, tDisc]);

  const stopGenerateNote = useCallback(() => {
    noteAbortRef.current?.abort();
  }, []);

  const hasNote = noteContent.length > 0 || isGeneratingNote || !!noteError;

  // Find related notes in the notes directory
  const handleFindRelatedNotes = async () => {
    if (!article) return;

    if (!notesDir) {
      toast.error(t("noNotesDir"));
      return;
    }

    setIsFindingRelated(true);
    try {
      const res = await fetch("/api/paper-study/find-related-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notesDir,
          article,
          ...(llmProvider && llmModel ? { llmProvider, llmModel } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      const data = await res.json();
      const notes: RelatedNote[] = data.related || [];

      if (notes.length === 0) {
        toast.info(t("noRelatedNotes"));
        return;
      }

      setRelatedNotes(notes);
      // Reset chat so the new transport with related notes context takes effect
      setMessages([]);
      toast.success(t("relatedNotesFound", { count: notes.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setIsFindingRelated(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {showNoteDiscussion && (discussionNote || article) ? (
        <NoteDiscussionView
          noteTitle={discussionNote?.title || noteMeta?.methodName || article?.title || ""}
          noteContent={discussionNote?.content || noteContent}
          noteFilePath={discussionNote?.filePath || noteMeta?.filePath}
          notesDir={notesDir}
          article={article}
          llmProvider={llmProvider}
          llmModel={llmModel}
          onBack={() => {
            setShowNoteDiscussion(false);
            setDiscussionNote(null);
          }}
        />
      ) : (
      <>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold truncate pr-2">
          {article ? article.title : t("notesTab")}
        </h3>
        {article && (
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Tabs: Detail / Chat / Notes */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="mx-2 mt-1 shrink-0">
          <TabsTrigger value="detail" className="gap-1 text-xs" disabled={!article}>
            <BookOpen className="h-3 w-3" />
            {t("abstract")}
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1 text-xs" disabled={!article}>
            <MessageSquare className="h-3 w-3" />
            {t("chatTitle")}
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1 text-xs">
            <FileText className="h-3 w-3" />
            {t("notesTab")}
          </TabsTrigger>
          <TabsTrigger value="ideation" className="gap-1 text-xs" disabled={!article}>
            <Lightbulb className="h-3 w-3" />
            {t("ideationTab")}
          </TabsTrigger>
          <TabsTrigger value="discussion" className="gap-1 text-xs" disabled={!article}>
            <Users className="h-3 w-3" />
            {t("discussionTab")}
          </TabsTrigger>
        </TabsList>

        {/* Detail tab */}
        <TabsContent value="detail" className="flex-1 overflow-hidden mt-0">
          {article && (
            <ScrollArea className="h-full p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {article.source === "arxiv"
                    ? t("sourceArxiv")
                    : article.source === "semantic-scholar"
                      ? t("sourceSemanticScholar")
                      : article.source === "local"
                        ? t("sourceLocal")
                        : t("sourceHuggingFace")}
                </Badge>
                {date && (
                  <span className="text-xs text-muted-foreground">
                    {t("publishedDate")}: {date}
                  </span>
                )}
              </div>

              {article.authors.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">
                    {t("authors")}
                  </h4>
                  <p className="text-sm">{article.authors.join(", ")}</p>
                </div>
              )}

              <div className="mb-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-1">
                  {t("abstract")}
                </h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {article.abstract}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1" asChild>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t("openArticle")}
                  </a>
                </Button>
                {(article.pdfUrl || article.source === "arxiv") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={handleDownloadPdf}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t("downloadPdf")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={startGenerateNote}
                  disabled={isGeneratingNote}
                >
                  {isGeneratingNote ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <NotebookPen className="h-3.5 w-3.5" />
                  )}
                  {isGeneratingNote ? t("generatingNote") : t("generateNote")}
                </Button>
              </div>

              {/* Score badge */}
              {article.score !== undefined && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    {t("scoreLabel")}: {article.score}
                  </Badge>
                  {article.upvotes !== undefined && article.upvotes > 0 && (
                    <Badge variant="outline" className="text-xs ml-1">
                      {t("upvotesLabel")}: {article.upvotes}
                    </Badge>
                  )}
                </div>
              )}

              {/* Structured note generation progress */}
              {hasNote && (
                <div className="mt-3 border rounded p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium flex items-center gap-1">
                      <NotebookPen className="h-3 w-3" />
                      {noteMeta?.methodName
                        ? `${t("noteFor")}: ${noteMeta.methodName}`
                        : t("generateNote")}
                    </span>
                    {isGeneratingNote && (
                      <Button variant="ghost" size="xs" className="text-xs" onClick={stopGenerateNote}>
                        <Square className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {noteContent && (
                    <ScrollArea className="max-h-48">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                        <ReactMarkdown>{noteContent.slice(0, 2000) + (noteContent.length > 2000 ? "\n\n..." : "")}</ReactMarkdown>
                      </div>
                    </ScrollArea>
                  )}

                  {isGeneratingNote && !noteContent && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs">{t("generatingNote")}</span>
                    </div>
                  )}

                  {noteError && (
                    <div className="p-2 rounded border border-destructive/50 bg-destructive/5 text-destructive text-xs">
                      {noteError}
                    </div>
                  )}

                  {!isGeneratingNote && noteMeta?.filePath && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="xs" className="gap-1 text-xs" asChild>
                        <a
                          href={`obsidian://open?file=${encodeURIComponent(noteMeta.fileName || "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t("openInObsidian")}
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        className="gap-1 text-xs"
                        onClick={() => setShowNoteDiscussion(true)}
                      >
                        <MessageSquare className="h-3 w-3" />
                        {t("discussNote")}
                      </Button>
                      <span className="text-xs text-muted-foreground self-center">
                        {noteMeta.fileName}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          )}
        </TabsContent>

        {/* Chat tab */}
        <TabsContent
          value="chat"
          className="flex flex-1 flex-col overflow-hidden mt-0"
        >
          {article && (
            <>
              {/* Quick Summary button bar */}
              <div className="border-b px-3 py-1.5 flex items-center gap-2 shrink-0">
                {!hasSummary && (
                  <Button
                    variant="outline"
                    size="xs"
                    className="gap-1 text-xs"
                    onClick={startQuickSummary}
                    disabled={isSummarizing}
                  >
                    <FileText className="h-3 w-3" />
                    {tDisc("quickSummary")}
                  </Button>
                )}
                {isSummarizing && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="gap-1 text-xs"
                    onClick={stopQuickSummary}
                  >
                    <Square className="h-3 w-3" />
                    {tDisc("stopSummary")}
                  </Button>
                )}
                {hasSummary && !isSummarizing && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {tDisc("summaryComplete")}
                  </span>
                )}
              </div>

              {/* Quick Summary display */}
              {hasSummary && (
                <ScrollArea ref={summaryScrollRef} className="max-h-[50%] shrink-0 border-b">
                  <div className="p-3 space-y-3">
                    {/* Figures */}
                    {summaryFigures.length > 0 && (
                      <div className="space-y-2">
                        {summaryFigures
                          .filter((f) => f.url)
                          .map((fig, i) => (
                            <figure key={fig.figureId || i} className="border rounded p-2 bg-muted/30">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={fig.dataUrl || proxyImageUrl(fig.url)}
                                alt={fig.caption || `Figure ${i + 1}`}
                                className="max-w-full h-auto rounded"
                                loading="lazy"
                              />
                              {fig.caption && (
                                <figcaption className="text-xs text-muted-foreground mt-1">
                                  {fig.caption}
                                </figcaption>
                              )}
                            </figure>
                          ))}
                      </div>
                    )}

                    {/* Summary text */}
                    {quickSummary && (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown
                          components={{
                            img: ({ src, alt }) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={proxyImageUrl(typeof src === "string" ? src : "")} alt={alt || ""} className="max-w-full h-auto rounded" loading="lazy" />
                            ),
                          }}
                        >{quickSummary}</ReactMarkdown>
                      </div>
                    )}

                    {/* Loading */}
                    {isSummarizing && !quickSummary && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">{tDisc("summarizing")}</span>
                      </div>
                    )}

                    {/* Error */}
                    {summaryError && (
                      <div className="p-2 rounded border border-destructive/50 bg-destructive/5 text-destructive text-sm">
                        {summaryError}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}

              {/* Related notes indicator */}
              {relatedNotes.length > 0 && (
                <div className="border-b px-3 py-1.5 bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    <Link2 className="h-3 w-3 inline mr-1" />
                    {t("relatedNotesContext")} ({relatedNotes.length})
                  </p>
                </div>
              )}

              {/* Chat messages */}
              <ScrollArea className="flex-1 p-3">
                <ChatMessageList
                  messages={messages}
                  isLoading={isLoading}
                  emptyText={t("chatEmpty")}
                />
              </ScrollArea>

              {/* Action buttons: Save discussion + Find related notes */}
              {messages.length > 0 && (
                <div className="border-t px-3 py-1.5 flex justify-between">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="gap-1 text-xs"
                    onClick={handleFindRelatedNotes}
                    disabled={isFindingRelated || relatedNotes.length > 0}
                  >
                    {isFindingRelated ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                    {isFindingRelated
                      ? t("findingRelated")
                      : relatedNotes.length > 0
                        ? t("relatedNotesContext")
                        : t("relatedNotes")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="gap-1 text-xs"
                    onClick={handleSaveDiscussionToFile}
                    disabled={savedDiscussion}
                  >
                    {savedDiscussion ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    {savedDiscussion ? t("savedDiscussionToFile") : t("saveDiscussionToFile")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="gap-1 text-xs"
                    onClick={handleSaveDiscussionToNotes}
                    disabled={savedDiscussionToNotes}
                  >
                    {savedDiscussionToNotes ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <BookOpen className="h-3 w-3" />
                    )}
                    {savedDiscussionToNotes ? t("savedDiscussionToNotes") : t("saveDiscussionToNotes")}
                  </Button>
                </div>
              )}

              {/* Chat input — isolated to prevent parent re-renders on keystroke */}
              <IsolatedChatInput
                onSend={handleSendMessage}
                isLoading={isLoading}
                placeholder={t("chatPlaceholder")}
              />
            </>
          )}
        </TabsContent>

        {/* Notes tab */}
        <TabsContent value="notes" className="flex-1 overflow-hidden mt-0">
          <PaperNotesPanel
            notesDir={notesDir}
            onSetNotesDir={onSetNotesDir || (() => {})}
            onDiscussNote={handleDiscussExistingNote}
            llmProvider={llmProvider}
            llmModel={llmModel}
          />
        </TabsContent>

        {/* Ideation tab */}
        <TabsContent value="ideation" className="flex-1 overflow-hidden mt-0">
          {article && <ResearchIdeationPanel article={article} workspaceId={workspaceId} llmProvider={llmProvider} llmModel={llmModel} />}
        </TabsContent>

        {/* Multi-agent discussion tab */}
        <TabsContent value="discussion" className="flex-1 overflow-hidden mt-0">
          {article && <PaperDiscussionPanel article={article} workspaceId={workspaceId} llmProvider={llmProvider} llmModel={llmModel} />}
        </TabsContent>
      </Tabs>
      </>
      )}
    </div>
  );
}
