"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import type { FileUIPart, UIMessage } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User, AlertCircle, Check, Circle, CheckCheck, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  markdownComponents,
  remarkPlugins,
  rehypePlugins,
} from "@/lib/markdown/shared-components";
import useSWR from "swr";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getOverflowThresholdChars,
  modelSupportsVision,
} from "@/lib/ai/models";
import { swrFetcher as fetcher } from "@/lib/fetcher";
import {
  createImageFileParts,
  extractImageFilesFromClipboard,
  getImageFileParts,
} from "@/lib/ai/message-attachments";
import {
  buildOverflowCompactionPlan,
  excludeKeptMessages,
  getRenderableMessages,
  requestConversationSummaryPreview,
  saveConversationMemoryNote,
} from "@/lib/agent/conversation-compaction";
import { getMessageText } from "@/components/agent/message-utils";
import { ImageAttachmentGrid } from "@/components/ui/image-attachment-grid";
import {
  ConversationMemoryPreviewDialog,
  ConversationMessageSelectionDialog,
} from "@/components/conversation/conversation-compaction-dialogs";

// --- Selectable options support ---

type MessageSegment =
  | { type: "text"; content: string; offset: number }
  | { type: "select"; selectType: "single" | "multi"; options: string[]; offset: number };

const MAX_SELECT_BLOCK_LENGTH = 10000;

function parseMessageSegments(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const selectStartToken = "[SELECT:";
  const selectEndToken = "[/SELECT]";
  let cursor = 0;

  while (cursor < text.length) {
    const startIdx = text.indexOf(selectStartToken, cursor);

    if (startIdx === -1) {
      if (cursor < text.length) {
        segments.push({ type: "text", content: text.slice(cursor), offset: cursor });
      }
      break;
    }

    if (startIdx > cursor) {
      segments.push({ type: "text", content: text.slice(cursor, startIdx), offset: cursor });
    }

    const headerEndIdx = text.indexOf("]", startIdx + selectStartToken.length);
    if (headerEndIdx === -1) {
      segments.push({ type: "text", content: text.slice(startIdx), offset: startIdx });
      break;
    }

    const selectTypeStr = text.slice(startIdx + selectStartToken.length, headerEndIdx).trim();

    if (selectTypeStr !== "single" && selectTypeStr !== "multi") {
      segments.push({ type: "text", content: text.slice(startIdx, headerEndIdx + 1), offset: startIdx });
      cursor = headerEndIdx + 1;
      continue;
    }

    let contentStartIdx = headerEndIdx + 1;
    if (text[contentStartIdx] === "\n") {
      contentStartIdx += 1;
    }

    const endIdx = text.indexOf(selectEndToken, contentStartIdx);

    if (endIdx === -1) {
      segments.push({ type: "text", content: text.slice(startIdx), offset: startIdx });
      break;
    }

    if (endIdx - contentStartIdx > MAX_SELECT_BLOCK_LENGTH) {
      segments.push({
        type: "text",
        content: text.slice(startIdx, endIdx + selectEndToken.length),
        offset: startIdx,
      });
      cursor = endIdx + selectEndToken.length;
      continue;
    }

    const optionsRaw = text.slice(contentStartIdx, endIdx);
    const options = optionsRaw
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length > 0);

    segments.push({
      type: "select",
      selectType: selectTypeStr as "single" | "multi",
      options,
      offset: startIdx,
    });

    cursor = endIdx + selectEndToken.length;
  }

  return segments;
}

function SelectableOptions({
  type,
  options,
  onConfirm,
  disabled,
}: {
  type: "single" | "multi";
  options: string[];
  onConfirm: (selected: string[]) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const t = useTranslations("chat");

  const toggle = (idx: number) => {
    if (confirmed || disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (type === "single") {
        if (next.has(idx)) {
          next.delete(idx);
        } else {
          next.clear();
          next.add(idx);
        }
      } else {
        if (next.has(idx)) {
          next.delete(idx);
        } else {
          next.add(idx);
        }
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.size === 0) return;
    setConfirmed(true);
    const selectedOptions = [...selected].sort().map((i) => options[i]);
    onConfirm(selectedOptions);
  };

  return (
    <div
      className="my-3 space-y-1.5 rounded-lg border border-border bg-card p-3"
      role={type === "single" ? "radiogroup" : "group"}
      aria-label={t("selectionOptions")}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {type === "single" ? (
          <Circle className="h-3 w-3" />
        ) : (
          <CheckCheck className="h-3 w-3" />
        )}
        <span>{t(type === "single" ? "selectOne" : "selectMultiple")}</span>
      </div>
      {options.map((option, idx) => {
        const isSelected = selected.has(idx);
        const isConfirmedSelected = confirmed && isSelected;
        return (
          <button
            key={idx}
            type="button"
            role={type === "single" ? "radio" : "checkbox"}
            aria-checked={isSelected}
            disabled={confirmed || disabled}
            onClick={() => toggle(idx)}
            className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
              isConfirmedSelected
                ? "border-green-500/50 bg-green-500/5"
                : isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-transparent hover:border-border hover:bg-muted/50"
            } ${confirmed && !isSelected ? "opacity-40" : ""} ${confirmed ? "cursor-default" : "cursor-pointer"}`}
          >
            {type === "multi" ? (
              <Checkbox
                checked={isSelected}
                className="mt-0.5 pointer-events-none"
                tabIndex={-1}
              />
            ) : (
              <div
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                }`}
              >
                {isSelected && <Circle className="h-1.5 w-1.5 fill-primary-foreground text-primary-foreground" />}
              </div>
            )}
            <span className="text-sm leading-relaxed flex-1">{option}</span>
            {isConfirmedSelected && (
              <Check className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
            )}
          </button>
        );
      })}
      {!confirmed && (
        <div className="pt-2">
          <Button
            size="sm"
            disabled={selected.size === 0 || disabled}
            onClick={handleConfirm}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            {t("confirmSelection")} {selected.size > 0 && `(${selected.size})`}
          </Button>
        </div>
      )}
      {confirmed && (
        <div className="flex items-center gap-1.5 pt-1 text-xs text-green-600 dark:text-green-400">
          <Check className="h-3 w-3" />
          {t("selectionConfirmed")}
        </div>
      )}
    </div>
  );
}

function AssistantMessageContent({
  content,
  messageId,
  isLoading,
  sendMessage,
}: {
  content: string;
  messageId: string;
  isLoading: boolean;
  sendMessage: (msg: { text: string }) => void;
}) {
  const t = useTranslations("chat");
  const segments = useMemo(() => parseMessageSegments(content), [content]);
  return (
    <div className="chat-prose max-w-none text-sm">
      {segments.map((seg) =>
        seg.type === "text" ? (
          <ReactMarkdown
            key={`${messageId}-t${seg.offset}`}
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={markdownComponents}
          >
            {seg.content}
          </ReactMarkdown>
        ) : (
          <SelectableOptions
            key={`${messageId}-s${seg.offset}`}
            type={seg.selectType}
            options={seg.options}
            disabled={isLoading}
            onConfirm={(selected) => {
              const text = selected.map((s, i) => `${i + 1}. ${s}`).join("\n");
              const prefix = t(seg.selectType === "single" ? "selectionSingle" : "selectionMulti");
              sendMessage({ text: `${prefix}\n${text}` });
            }}
          />
        )
      )}
    </div>
  );
}

interface ChatPanelProps {
  workspaceId: string;
  workspaceName: string;
}

export function ChatPanel({ workspaceId, workspaceName }: ChatPanelProps) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<FileUIPart[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const summarizingRef = useRef(false);
  const failedAtCountRef = useRef(-1);

  // Memory selection dialog state
  const [showMessageSelect, setShowMessageSelect] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const toggleMessage = useCallback((id: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const [showMemoryPreview, setShowMemoryPreview] = useState(false);
  const [memoryPreviewTitle, setMemoryPreviewTitle] = useState("");
  const [memoryPreviewContent, setMemoryPreviewContent] = useState("");
  // Track overflow-triggered dialog: stores messages to keep after memory save
  const overflowKeepRef = useRef<UIMessage[] | null>(null);

  const { data: settings } = useSWR("/api/settings", fetcher);
  const aiEnabled = settings?.hasAIKey ?? false;

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new TextStreamChatTransport({
      api: "/api/chat",
      body: { workspaceId },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const supportsVision = modelSupportsVision(
    settings?.llmProvider ?? "openai",
    settings?.llmModel ?? "gpt-4o-mini",
  );

  // --- Auto-memory: summarize and evict when context overflows ---
  const overflowThreshold = getOverflowThresholdChars(
    settings?.llmProvider ?? "openai",
    settings?.llmModel ?? "gpt-4o-mini",
    settings?.contextMode ?? "normal"
  );

  const summarizeAndEvict = useCallback(async (
    messagesToSummarize: UIMessage[],
    messagesToKeep: UIMessage[]
  ) => {
    if (summarizingRef.current) return;
    summarizingRef.current = true;
    failedAtCountRef.current = -1;
    setIsSummarizing(true);

    try {
      const res = await fetch("/api/agent/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          messages: messagesToSummarize,
          trigger: "overflow",
          locale,
        }),
      });

      if (!res.ok) {
        throw new Error("Summarization failed");
      }

      const memoryMarker = {
        id: `memory-${Date.now()}`,
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: t("memorySaved") }],
      } as UIMessage;
      setMessages([memoryMarker, ...messagesToKeep]);
    } catch {
      // On failure: do NOT evict messages; record count to prevent infinite retry
      failedAtCountRef.current = messagesToSummarize.length + messagesToKeep.length;
    } finally {
      setIsSummarizing(false);
      summarizingRef.current = false;
    }
  }, [workspaceId, locale, t, setMessages]);

  useEffect(() => {
    if (settings?.maxMode === false) return;
    if (isSummarizing) return;
    if (showMessageSelect || showMemoryPreview) return; // Don't trigger while dialog is open
    if (status !== "ready" && status !== "error") return;
    if (messages.length < 4) return;
    if (messages.length === failedAtCountRef.current) return;

    const plan = buildOverflowCompactionPlan({
      messages,
      overflowThreshold,
      failedAtCount: failedAtCountRef.current,
    });
    if (!plan) return;
    const { toSummarize, toKeep } = plan;

    // Show message selection dialog instead of auto-summarizing
    overflowKeepRef.current = toKeep;
    // Only pre-select messages with renderable text content
    setSelectedMessageIds(new Set(getRenderableMessages(toSummarize).map((message) => message.id)));
    setShowMessageSelect(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, isSummarizing, showMessageSelect, showMemoryPreview]);

  // --- Memory dialog handlers ---
  const handleSelectNext = async () => {
    setShowMessageSelect(false);
    const selected = messages.filter((message) => selectedMessageIds.has(message.id));
    if (selected.length === 0) return;

    setIsSummarizing(true);
    try {
      const data = await requestConversationSummaryPreview({
        workspaceId,
        messages: selected,
        trigger: "overflow",
        locale,
      });
      setMemoryPreviewTitle(data.title);
      setMemoryPreviewContent(data.content);
      setShowMemoryPreview(true);
    } catch {
      // Fall back to silent auto-summarize on preview failure
      if (overflowKeepRef.current) {
        const toKeep = overflowKeepRef.current;
        const toSummarize = excludeKeptMessages(messages, toKeep);
        overflowKeepRef.current = null;
        await summarizeAndEvict(toSummarize, toKeep);
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSelectCancel = () => {
    setShowMessageSelect(false);
    setSelectedMessageIds(new Set());
    if (overflowKeepRef.current) {
      // User cancelled — fall back to silent auto-summarize
      const toKeep = overflowKeepRef.current;
      const toSummarize = excludeKeptMessages(messages, toKeep);
      overflowKeepRef.current = null;
      summarizeAndEvict(toSummarize, toKeep);
    }
  };

  const handleMemoryConfirm = async () => {
    setShowMemoryPreview(false);
    setIsSummarizing(true);
    try {
      await saveConversationMemoryNote({
        workspaceId,
        title: memoryPreviewTitle,
        content: memoryPreviewContent,
      });

      if (overflowKeepRef.current) {
        // Overflow: keep recent messages, inject memory marker
        const memoryMarker = {
          id: `memory-${Date.now()}`,
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: t("memorySaved") }],
        } as UIMessage;
        setMessages([memoryMarker, ...overflowKeepRef.current]);
        overflowKeepRef.current = null;
      }
    } catch {
      // On failure, fall back to silent summarize
      if (overflowKeepRef.current) {
        const toKeep = overflowKeepRef.current;
        const toSummarize = excludeKeptMessages(messages, toKeep);
        overflowKeepRef.current = null;
        await summarizeAndEvict(toSummarize, toKeep);
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleMemoryCancel = () => {
    setShowMemoryPreview(false);
    setMemoryPreviewTitle("");
    setMemoryPreviewContent("");
    if (overflowKeepRef.current) {
      // User cancelled — fall back to silent auto-summarize
      const toKeep = overflowKeepRef.current;
      const toSummarize = excludeKeptMessages(messages, toKeep);
      overflowKeepRef.current = null;
      summarizeAndEvict(toSummarize, toKeep);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const suggestedQuestions = [
    t("suggested.summarize"),
    t("suggested.keyThemes"),
    t("suggested.overview"),
  ];

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || isLoading || !aiEnabled || isSummarizing) {
      return;
    }
    if (pendingImages.length > 0 && !supportsVision) {
      toast.error(t("imageInputUnsupported"));
      return;
    }

    const files = pendingImages;
    setInput("");
    setPendingImages([]);

    try {
      if (text && files.length > 0) {
        await sendMessage({ text, files });
      } else if (text) {
        await sendMessage({ text });
      } else {
        await sendMessage({ files });
      }
    } catch {
      setInput(text);
      setPendingImages(files);
    }
  };

  const handleInputPaste = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const imageFiles = extractImageFilesFromClipboard(event.clipboardData);
    if (imageFiles.length === 0) return;

    event.preventDefault();

    if (!supportsVision) {
      toast.error(t("imageInputUnsupported"));
      return;
    }

    try {
      const nextImages = await createImageFileParts(imageFiles);
      setPendingImages((current) => [...current, ...nextImages]);
    } catch {
      toast.error(t("imagePasteFailed"));
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  // Messages that have renderable text content (used for selection UI)
  const selectableMessages = useMemo(
    () => getRenderableMessages(messages),
    [messages]
  );

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{workspaceName}</h2>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {!aiEnabled ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="max-w-sm space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("disabledState")}
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <Bot className="h-12 w-12 text-muted-foreground" />
            <div className="max-w-sm space-y-2">
              <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedQuestions.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setInput(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : ""
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <AssistantMessageContent
                      content={getMessageText(message)}
                      messageId={message.id}
                      isLoading={isLoading}
                      sendMessage={sendMessage}
                    />
                  ) : (
                    <div className="space-y-2">
                      <ImageAttachmentGrid
                        attachments={getImageFileParts(message)}
                        imageClassName="h-32 w-32"
                        removeLabel={t("removeImage")}
                      />
                      {getMessageText(message) ? (
                        <p className="whitespace-pre-wrap">{getMessageText(message)}</p>
                      ) : null}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-lg bg-muted px-4 py-2">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0.2s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            {isSummarizing && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
                <Brain className="h-3.5 w-3.5 animate-pulse" />
                {t("summarizing")}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="space-y-3">
          <ImageAttachmentGrid
            attachments={pendingImages}
            onRemove={removePendingImage}
            removeLabel={t("removeImage")}
          />
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handleInputPaste}
              placeholder={aiEnabled ? t("placeholder") : t("disabledState")}
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
              disabled={!aiEnabled || isSummarizing}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              size="icon"
              disabled={
                !aiEnabled ||
                isLoading ||
                isSummarizing ||
                (!input.trim() && pendingImages.length === 0)
              }
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <ConversationMessageSelectionDialog
        open={showMessageSelect}
        onCancel={handleSelectCancel}
        messages={messages}
        selectedMessageIds={selectedMessageIds}
        getMessageText={getMessageText}
        onToggleMessage={toggleMessage}
        onSelectAll={() => setSelectedMessageIds(new Set(selectableMessages.map((m) => m.id)))}
        onSelectNone={() => setSelectedMessageIds(new Set())}
        onConfirm={handleSelectNext}
        labels={{
          title: t("selectMessagesTitle"),
          description: t("selectMessagesDesc"),
          roleUser: t("roleUser"),
          roleAssistant: t("roleAssistant"),
          selectAll: t("selectAll"),
          selectNone: t("selectNone"),
          cancel: t("cancel"),
          confirm: t("nextStep"),
        }}
        variant="default"
        className="max-w-lg max-h-[80vh] flex flex-col"
        scrollAreaClassName="flex-1 min-h-0 max-h-[50vh] pr-2"
      />

      <ConversationMemoryPreviewDialog
        open={showMemoryPreview}
        onCancel={handleMemoryCancel}
        titleValue={memoryPreviewTitle}
        contentValue={memoryPreviewContent}
        onTitleChange={setMemoryPreviewTitle}
        onContentChange={setMemoryPreviewContent}
        onConfirm={handleMemoryConfirm}
        confirmDisabled={!memoryPreviewTitle.trim()}
        labels={{
          title: t("memoryPreviewTitle"),
          description: t("memoryPreviewDesc"),
          cancel: t("cancel"),
          confirm: t("memoryConfirm"),
          memoryTitle: t("memoryNoteTitle"),
          memoryContent: t("memoryNoteContent"),
        }}
        variant="default"
        className="max-w-lg max-h-[80vh] flex flex-col"
      />
    </div>
  );
}
