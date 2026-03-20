"use client";

import { useState, useRef, useEffect, useMemo, useCallback, memo, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import {
  Send,
  Loader2,
  MessageSquare,
  Save,
  Check,
  Link2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  notesDir?: string;
  llmProvider?: string | null;
  llmModel?: string | null;
}

// --- Memoized sub-components to prevent re-renders on input change ---

interface NoteChatMessageItemProps {
  role: string;
  parts?: Array<{ type: string; text?: string }>;
}

const NoteChatMessageItem = memo(function NoteChatMessageItem({ role, parts }: NoteChatMessageItemProps) {
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

interface NoteChatMessageListProps {
  messages: Array<{ id: string; role: string; parts?: Array<{ type: string; text?: string }> }>;
  isLoading: boolean;
  emptyText: string;
}

const NoteChatMessageList = memo(function NoteChatMessageList({ messages, isLoading, emptyText }: NoteChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground max-w-[240px]">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <NoteChatMessageItem key={m.id} role={m.role} parts={m.parts} />
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

interface NoteIsolatedChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  placeholder: string;
}

function NoteIsolatedChatInput({ onSend, isLoading, placeholder }: NoteIsolatedChatInputProps) {
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
    <div className="border-t p-3 flex gap-2 shrink-0">
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

export function NoteDiscussionDialog({
  open,
  onClose,
  noteTitle,
  noteContent,
  noteFilePath,
  notesDir,
  llmProvider,
  llmModel,
}: NoteDiscussionDialogProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");
  const [discussionSaved, setDiscussionSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Related notes state
  const [showNotePicker, setShowNotePicker] = useState(false);
  const [availableNotes, setAvailableNotes] = useState<Array<{ name: string; path: string }>>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<Array<{ name: string; content: string }>>([]);
  const [loadingNoteContent, setLoadingNoteContent] = useState<string | null>(null);

  // Fetch available notes from notesDir
  const fetchAvailableNotes = useCallback(async () => {
    if (!notesDir) return;
    setLoadingNotes(true);
    try {
      const allMdFiles: Array<{ name: string; path: string }> = [];
      async function browseRecursive(dir: string, prefix: string) {
        const res = await fetch(`/api/files/browse?path=${encodeURIComponent(dir)}`);
        if (!res.ok) return;
        const entries: Array<{ name: string; type: string; path: string }> = await res.json();
        for (const entry of entries) {
          if (entry.type === "directory") {
            await browseRecursive(entry.path, prefix ? `${prefix}/${entry.name}` : entry.name);
          } else if (entry.type === "file" && entry.name.endsWith(".md") && entry.path !== noteFilePath) {
            allMdFiles.push({
              name: prefix ? `${prefix}/${entry.name}` : entry.name,
              path: entry.path,
            });
          }
        }
      }
      await browseRecursive(notesDir, "");
      setAvailableNotes(allMdFiles);
    } catch {
      // ignore
    } finally {
      setLoadingNotes(false);
    }
  }, [notesDir, noteFilePath]);

  // Fetch notes when picker opens
  useEffect(() => {
    if (showNotePicker && availableNotes.length === 0) {
      fetchAvailableNotes();
    }
  }, [showNotePicker, availableNotes.length, fetchAvailableNotes]);

  // Toggle note selection
  const handleToggleNote = useCallback(async (note: { name: string; path: string }) => {
    const existing = selectedNotes.find((n) => n.name === note.name);
    if (existing) {
      setSelectedNotes((prev) => prev.filter((n) => n.name !== note.name));
      return;
    }
    setLoadingNoteContent(note.name);
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(note.path)}`);
      if (!res.ok) throw new Error("Read failed");
      const data = await res.json();
      const content = typeof data === "string" ? data : data.content || "";
      setSelectedNotes((prev) => [...prev, { name: note.name, content }]);
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setLoadingNoteContent(null);
    }
  }, [selectedNotes, tCommon]);

  const removeSelectedNote = useCallback((name: string) => {
    setSelectedNotes((prev) => prev.filter((n) => n.name !== name));
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/paper-study/note-chat",
        body: {
          noteTitle,
          noteContent,
          ...(selectedNotes.length > 0 ? { relatedNotes: selectedNotes } : {}),
          ...(llmProvider && llmModel ? { llmProvider, llmModel } : {}),
        },
      }),
    [noteTitle, noteContent, selectedNotes, llmProvider, llmModel]
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  // Reset when dialog opens with new content
  useEffect(() => {
    if (open) {
      setMessages([]);
      setDiscussionSaved(false);
      setSelectedNotes([]);
      setShowNotePicker(false);
      setAvailableNotes([]);
    }
  }, [open, noteTitle, setMessages]);

  // Reset chat when related notes change so new context takes effect
  useEffect(() => {
    setMessages([]);
  }, [selectedNotes, setMessages]);

  const isLoading = status === "streaming" || status === "submitted";

  const handleSendMessage = useCallback((text: string) => {
    sendMessage({ text });
  }, [sendMessage]);

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
            {notesDir && (
              <Button
                variant={showNotePicker ? "secondary" : "outline"}
                size="xs"
                className="gap-1 text-xs shrink-0"
                onClick={() => setShowNotePicker((v) => !v)}
              >
                <Link2 className="h-3 w-3" />
                {selectedNotes.length > 0
                  ? t("notesLinked", { count: selectedNotes.length })
                  : t("linkNotes")}
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Selected notes badges */}
        {selectedNotes.length > 0 && (
          <div className="flex flex-wrap gap-1 px-4 py-1.5 border-b bg-muted/20 shrink-0">
            <Link2 className="h-3 w-3 text-muted-foreground self-center mr-0.5" />
            {selectedNotes.map((n) => (
              <Badge key={n.name} variant="secondary" className="text-xs gap-1 pr-1">
                {n.name.replace(/\.md$/, "")}
                <button
                  type="button"
                  className="ml-0.5 hover:text-destructive"
                  onClick={() => removeSelectedNote(n.name)}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Note picker panel */}
        {showNotePicker && (
          <div className="border-b shrink-0 max-h-40 overflow-hidden flex flex-col">
            <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground border-b shrink-0">
              {t("selectNotes")}
            </div>
            <ScrollArea className="flex-1">
              <div className="px-4 py-1">
                {loadingNotes ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs">{tCommon("loading")}</span>
                  </div>
                ) : availableNotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">{t("noNotesAvailable")}</p>
                ) : (
                  availableNotes.map((note) => {
                    const isSelected = selectedNotes.some((n) => n.name === note.name);
                    const isLoadingThis = loadingNoteContent === note.name;
                    return (
                      <label
                        key={note.path}
                        className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer text-xs"
                      >
                        {isLoadingThis ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                        ) : (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleNote(note)}
                            className="h-3.5 w-3.5"
                          />
                        )}
                        <span className="truncate">{note.name.replace(/\.md$/, "")}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        )}

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
          <NoteChatMessageList
            messages={messages}
            isLoading={isLoading}
            emptyText={t("chatEmpty")}
          />
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

        {/* Chat input — isolated to prevent parent re-renders on keystroke */}
        <NoteIsolatedChatInput
          onSend={handleSendMessage}
          isLoading={isLoading}
          placeholder={t("chatPlaceholder")}
        />
      </DialogContent>
    </Dialog>
  );
}
