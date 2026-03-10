"use client";

import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
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
import { PaperNotesPanel } from "./paper-notes-panel";

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
}

export function ArticlePreview({
  article,
  onClose,
  notesDir = "",
  onSetNotesDir,
}: ArticlePreviewProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");
  const [activeTab, setActiveTab] = useState(article ? "detail" : "notes");
  const [chatInput, setChatInput] = useState("");
  const [savedDiscussion, setSavedDiscussion] = useState(false);
  const [isFindingRelated, setIsFindingRelated] = useState(false);
  const [relatedNotes, setRelatedNotes] = useState<RelatedNote[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
            body: { article, relatedNotes: relatedNotes.length > 0 ? relatedNotes : undefined },
          })
        : new DefaultChatTransport({
            api: "/api/paper-study/chat",
            body: { article: null },
          }),
    [article, relatedNotes]
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

  // Auto-scroll chat messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text || isLoading) return;
    setChatInput("");
    sendMessage({ text });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
        body: JSON.stringify({ notesDir, article }),
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
              </div>
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
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      {t("chatEmpty")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            m.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {m.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown>
                                {m.parts
                                  ?.filter(
                                    (p): p is { type: "text"; text: string } =>
                                      p.type === "text"
                                  )
                                  .map((p) => p.text)
                                  .join("") || ""}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <span>
                              {m.parts
                                ?.filter(
                                  (p): p is { type: "text"; text: string } =>
                                    p.type === "text"
                                )
                                .map((p) => p.text)
                                .join("") || ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {isLoading &&
                      messages[messages.length - 1]?.role === "user" && (
                        <div className="flex justify-start">
                          <div className="rounded-lg bg-muted px-3 py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        </div>
                      )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
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
                </div>
              )}

              {/* Chat input */}
              <div className="border-t p-2 flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("chatPlaceholder")}
                  className="h-8 text-sm"
                  disabled={isLoading}
                />
                <Button
                  size="icon-xs"
                  onClick={handleSendMessage}
                  disabled={isLoading || !chatInput.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* Notes tab */}
        <TabsContent value="notes" className="flex-1 overflow-hidden mt-0">
          <PaperNotesPanel
            notesDir={notesDir}
            onSetNotesDir={onSetNotesDir || (() => {})}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
