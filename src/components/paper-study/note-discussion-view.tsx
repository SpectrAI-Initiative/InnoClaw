"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  memo,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Send,
  Loader2,
  MessageSquare,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
  Users,
  Link2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { toast } from "sonner";
import { resolveObsidianEmbeds } from "@/lib/utils/obsidian";
import { PaperDiscussionPanel } from "./paper-discussion-panel";
import type { Article } from "@/lib/article-search/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NoteDiscussionViewProps {
  noteTitle: string;
  noteContent: string;
  noteFilePath?: string;
  notesDir: string;
  article?: Article | null;
  llmProvider?: string | null;
  llmModel?: string | null;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Memoized chat sub-components (same pattern as note-discussion-dialog)
// ---------------------------------------------------------------------------

interface ChatMsgProps {
  role: string;
  parts?: Array<{ type: string; text?: string }>;
}

const ChatMsg = memo(function ChatMsg({ role, parts }: ChatMsgProps) {
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
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {text}
            </ReactMarkdown>
          </div>
        ) : (
          <span>{text}</span>
        )}
      </div>
    </div>
  );
});

interface ChatMsgListProps {
  messages: Array<{ id: string; role: string; parts?: Array<{ type: string; text?: string }> }>;
  isLoading: boolean;
  emptyText: string;
}

const ChatMsgList = memo(function ChatMsgList({ messages, isLoading, emptyText }: ChatMsgListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
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
        <ChatMsg key={m.id} role={m.role} parts={m.parts} />
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <div className="flex justify-start">
          <div className="rounded-lg bg-muted px-3 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
});

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  placeholder: string;
}

function ChatInput({ onSend, isLoading, placeholder }: ChatInputProps) {
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
    [handleSend],
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NoteDiscussionView({
  noteTitle,
  noteContent,
  noteFilePath,
  notesDir,
  article,
  llmProvider,
  llmModel,
  onBack,
}: NoteDiscussionViewProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");

  const [noteCollapsed, setNoteCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDebate, setShowDebate] = useState(false);

  // Related notes state
  const [showNotePicker, setShowNotePicker] = useState(false);
  const [availableNotes, setAvailableNotes] = useState<Array<{ name: string; path: string }>>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<Array<{ name: string; content: string }>>([]);
  const [loadingNoteContent, setLoadingNoteContent] = useState<string | null>(null);

  // Fetch available notes from notesDir (recursively including subdirectories)
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

    // Fetch content and add
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

  // Resolve Obsidian embeds for browser rendering
  const renderedContent = useMemo(
    () => resolveObsidianEmbeds(noteContent, notesDir),
    [noteContent, notesDir],
  );

  // Chat transport → /api/paper-study/note-chat (includes relatedNotes)
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
    [noteTitle, noteContent, selectedNotes, llmProvider, llmModel],
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });
  const isLoading = status === "streaming" || status === "submitted";

  // Reset chat when related notes change so new context takes effect
  useEffect(() => {
    setMessages([]);
  }, [selectedNotes, setMessages]);

  const handleSendMessage = useCallback(
    (text: string) => {
      sendMessage({ text });
    },
    [sendMessage],
  );

  // Save discussion to note file (append)
  const handleSaveDiscussion = async () => {
    if (messages.length === 0 || !noteFilePath) return;
    setSaving(true);
    try {
      const readRes = await fetch(
        `/api/files/read?path=${encodeURIComponent(noteFilePath)}`,
      );
      let currentContent = "";
      if (readRes.ok) {
        const data = await readRes.json();
        currentContent = typeof data === "string" ? data : data.content || "";
      }

      const userLabel = t("discussionRoleUser");
      const aiLabel = t("discussionRoleAI");
      const discussionMd = messages
        .map((m) => {
          const role = m.role === "user" ? `**${userLabel}**` : `**${aiLabel}**`;
          const text =
            m.parts
              ?.filter(
                (p): p is { type: "text"; text: string } => p.type === "text",
              )
              .map((p) => p.text)
              .join("\n") || "";
          return `${role}:\n${text}`;
        })
        .join("\n\n---\n\n");

      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const appendContent = `\n\n---\n\n## 讨论记录 (${timestamp})\n\n${discussionMd}`;

      const writeRes = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: noteFilePath,
          content: currentContent + appendContent,
        }),
      });

      if (!writeRes.ok) throw new Error("Write failed");

      setSaved(true);
      toast.success(t("discussionSaved"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0">
        <Button variant="ghost" size="icon-xs" onClick={showDebate ? () => setShowDebate(false) : onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="flex-1 truncate text-sm font-semibold">
          {showDebate ? t("multiAgentDebate") : `${t("discussNote")}: ${noteTitle}`}
        </h3>
        {!showDebate && (
          <>
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
            {article && (
              <Button
                variant="outline"
                size="xs"
                className="gap-1 text-xs shrink-0"
                onClick={() => setShowDebate(true)}
              >
                <Users className="h-3 w-3" />
                {t("startDebate")}
              </Button>
            )}
          </>
        )}
        {!showDebate && messages.length > 0 && noteFilePath && (
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-xs shrink-0"
            onClick={handleSaveDiscussion}
            disabled={saving || saved}
          >
            {saved ? (
              <Check className="h-3 w-3" />
            ) : saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {saved ? t("discussionSaved") : t("saveDiscussion")}
          </Button>
        )}
      </div>

      {/* Selected notes badges */}
      {!showDebate && selectedNotes.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-1.5 border-b bg-muted/20 shrink-0">
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
      {!showDebate && showNotePicker && (
        <div className="border-b shrink-0 max-h-40 overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b shrink-0">
            {t("selectNotes")}
          </div>
          <ScrollArea className="flex-1">
            <div className="px-3 py-1">
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

      {showDebate && article ? (
        /* Multi-agent debate panel */
        <div className="flex-1 overflow-hidden">
          <PaperDiscussionPanel article={article} llmProvider={llmProvider} llmModel={llmModel} />
        </div>
      ) : (
      /* Main content: top note + bottom chat */
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top: Note content — scrollable, collapsible */}
        <div className="flex flex-col border-b overflow-hidden" style={{ minHeight: noteCollapsed ? 0 : "20%", maxHeight: noteCollapsed ? "auto" : "50%" }}>
          <div className="px-3 py-1.5 border-b shrink-0 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("notePreview")}: {noteTitle}
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground p-0.5"
              onClick={() => setNoteCollapsed(!noteCollapsed)}
            >
              {noteCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {!noteCollapsed && (
            <ScrollArea className="flex-1">
              <div className="prose prose-sm dark:prose-invert max-w-none px-4 py-3">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    img: (props) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        {...props}
                        alt=""
                        style={{ maxWidth: "100%", height: "auto" }}
                        loading="lazy"
                      />
                    ),
                  }}
                >
                  {renderedContent}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Bottom: Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <ChatMsgList
              messages={messages}
              isLoading={isLoading}
              emptyText={t("chatEmpty")}
            />
          </ScrollArea>

          {/* Chat input */}
          <ChatInput
            onSend={handleSendMessage}
            isLoading={isLoading}
            placeholder={t("chatPlaceholder")}
          />
        </div>
      </div>
      )}
    </div>
  );
}
