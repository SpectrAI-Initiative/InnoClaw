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

interface ArticlePreviewProps {
  article: Article;
  workspaceId: string;
  onClose: () => void;
}

export function ArticlePreview({ article, workspaceId, onClose }: ArticlePreviewProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");
  const [activeTab, setActiveTab] = useState("detail");
  const [chatInput, setChatInput] = useState("");
  const [importedDiscussion, setImportedDiscussion] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const date = article.publishedDate
    ? new Date(article.publishedDate).toLocaleDateString()
    : "";

  // Chat transport with article context — stable reference
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/paper-study/chat",
        body: { article },
      }),
    [article]
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

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
    const pdfUrl =
      article.pdfUrl ||
      (article.source === "arxiv"
        ? article.url.replace("/abs/", "/pdf/")
        : null);
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  };

  const handleImportDiscussion = async () => {
    if (messages.length === 0) return;

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

    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: `${t("discussionNoteTitle")}: ${article.title.slice(0, 60)} - ${dateStr}`,
          content,
          type: "manual",
        }),
      });
      if (!res.ok) {
        toast.error(tCommon("error"));
        return;
      }
      setImportedDiscussion(true);
      toast.success(t("imported"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setTimeout(() => setImportedDiscussion(false), 3000);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold truncate pr-2">
          {article.title}
        </h3>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tabs: Detail / Chat */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="mx-2 mt-1 shrink-0">
          <TabsTrigger value="detail" className="gap-1 text-xs">
            <BookOpen className="h-3 w-3" />
            {t("abstract")}
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1 text-xs">
            <MessageSquare className="h-3 w-3" />
            {t("chatTitle")}
          </TabsTrigger>
        </TabsList>

        {/* Detail tab */}
        <TabsContent value="detail" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {article.source === "arxiv"
                  ? t("sourceArxiv")
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
        </TabsContent>

        {/* Chat tab */}
        <TabsContent
          value="chat"
          className="flex flex-1 flex-col overflow-hidden mt-0"
        >
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

          {/* Import discussion button */}
          {messages.length > 0 && (
            <div className="border-t px-3 py-1.5 flex justify-end">
              <Button
                variant="ghost"
                size="xs"
                className="gap-1 text-xs"
                onClick={handleImportDiscussion}
                disabled={importedDiscussion}
              >
                {importedDiscussion ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {importedDiscussion ? t("imported") : t("importDiscussion")}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
