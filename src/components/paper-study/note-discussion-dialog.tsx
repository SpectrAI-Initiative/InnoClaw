"use client";

import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import {
  Send,
  Loader2,
  MessageSquare,
  Save,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface NoteDiscussionDialogProps {
  open: boolean;
  onClose: () => void;
  noteTitle: string;
  noteContent: string;
  noteFilePath?: string;
}

export function NoteDiscussionDialog({
  open,
  onClose,
  noteTitle,
  noteContent,
  noteFilePath,
}: NoteDiscussionDialogProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");
  const [chatInput, setChatInput] = useState("");
  const [discussionSaved, setDiscussionSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/paper-study/note-chat",
        body: { noteTitle, noteContent },
      }),
    [noteTitle, noteContent]
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  // Reset when dialog opens with new content
  useEffect(() => {
    if (open) {
      setMessages([]);
      setChatInput("");
      setDiscussionSaved(false);
    }
  }, [open, noteTitle, setMessages]);

  const isLoading = status === "streaming" || status === "submitted";

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

  const handleSaveDiscussion = async () => {
    if (messages.length === 0 || !noteFilePath) return;
    setSaving(true);
    try {
      // Read current file content
      const readRes = await fetch(
        `/api/files/read?path=${encodeURIComponent(noteFilePath)}`
      );
      let currentContent = "";
      if (readRes.ok) {
        const data = await readRes.json();
        currentContent = typeof data === "string" ? data : data.content || "";
      }

      // Format discussion
      const userLabel = t("discussionRoleUser");
      const aiLabel = t("discussionRoleAI");
      const discussionMd = messages
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
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const appendContent = `\n\n---\n\n## 讨论记录 (${timestamp})\n\n${discussionMd}`;

      // Write back
      const writeRes = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: noteFilePath,
          content: currentContent + appendContent,
        }),
      });

      if (!writeRes.ok) throw new Error("Write failed");

      setDiscussionSaved(true);
      toast.success(t("discussionSaved"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold truncate pr-4">
              {t("discussNote")}: {noteTitle}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Note content preview (collapsible) */}
        <details className="border-b shrink-0">
          <summary className="px-4 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted/30">
            {t("notePreview")}
          </summary>
          <ScrollArea className="max-h-40 px-4 pb-2">
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
              <ReactMarkdown>{noteContent.slice(0, 2000)}</ReactMarkdown>
            </div>
          </ScrollArea>
        </details>

        {/* Chat messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground max-w-[240px]">
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
              {isLoading && messages[messages.length - 1]?.role === "user" && (
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

        {/* Save discussion button */}
        {messages.length > 0 && noteFilePath && (
          <div className="border-t px-4 py-1.5 flex justify-end shrink-0">
            <Button
              variant="ghost"
              size="xs"
              className="gap-1 text-xs"
              onClick={handleSaveDiscussion}
              disabled={saving || discussionSaved}
            >
              {discussionSaved ? (
                <Check className="h-3 w-3" />
              ) : saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {discussionSaved ? t("discussionSaved") : t("saveDiscussion")}
            </Button>
          </div>
        )}

        {/* Chat input */}
        <div className="border-t p-3 flex gap-2 shrink-0">
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
      </DialogContent>
    </Dialog>
  );
}
