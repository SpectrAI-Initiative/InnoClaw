"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User, AlertCircle, FileText, Check, Circle } from "lucide-react";
import ReactMarkdown, { Components } from "react-markdown";
import useSWR from "swr";
import { Checkbox } from "@/components/ui/checkbox";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function unescapeCitationFilename(raw: string): string {
  return raw.replace(/\\(["\\])/g, "$1");
}

/**
 * Normalize grouped citations like [Source 1; Source 2; Source 3: "file.pdf"]
 * into individual citations: [Source 1: "file.pdf"][Source 2: "file.pdf"][Source 3: "file.pdf"]
 */
function normalizeGroupedCitations(text: string): string {
  return text.replace(
    /\[(Source\s+\d+(?:\s*;\s*Source\s+\d+)+)(?::\s*"((?:[^"\\]|\\.)*)")?\]/g,
    (_, sourcesPart: string, filename: string | undefined) => {
      const sourceRefs = sourcesPart.split(/\s*;\s*/);
      return sourceRefs
        .map((ref) =>
          filename ? `[${ref.trim()}: "${filename}"]` : `[${ref.trim()}]`
        )
        .join("");
    }
  );
}

/**
 * Parse [Source N: "filename"] or [Source N] into styled citation badges.
 */
function CitationText({ text }: { text: string }) {
  // First, normalize any grouped citations into individual ones
  const normalized = normalizeGroupedCitations(text);
  // Match [Source N: "filename"] or [Source N], allowing escaped quotes inside filenames
  const parts = normalized.split(/(\[Source\s+\d+(?::\s*"(?:[^"\\]|\\.)*")?\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[Source\s+(\d+)(?::\s*"((?:[^"\\]|\\.)*)")?\]$/);
        if (match) {
          const num = match[1];
          const rawFileName = match[2];
          const fileName = rawFileName ? unescapeCitationFilename(rawFileName) : undefined;
          return (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary align-middle mx-0.5"
              title={fileName ? `Source ${num}: ${fileName}` : `Source ${num}`}
            >
              <FileText className="h-3 w-3" />
              {fileName || `Source ${num}`}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/**
 * Create a custom ReactMarkdown component that processes citation badges.
 */
function renderWithProcessedChildren(
  Tag: keyof React.JSX.IntrinsicElements
): (props: { children?: React.ReactNode }) => React.JSX.Element {
  return function Component({ children, ...rest }: { children?: React.ReactNode }) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Tag {...(rest as any)}>
        {processChildren(children)}
      </Tag>
    );
  };
}

/**
 * Custom ReactMarkdown components that render source citations as badges.
 */
const markdownComponents: Components = {
  p: renderWithProcessedChildren("p"),
  li: renderWithProcessedChildren("li"),
  h1: renderWithProcessedChildren("h1"),
  h2: renderWithProcessedChildren("h2"),
  h3: renderWithProcessedChildren("h3"),
  h4: renderWithProcessedChildren("h4"),
  h5: renderWithProcessedChildren("h5"),
  h6: renderWithProcessedChildren("h6"),
  blockquote: renderWithProcessedChildren("blockquote"),
  th: renderWithProcessedChildren("th"),
  td: renderWithProcessedChildren("td"),
};

function processChildren(children: React.ReactNode): React.ReactNode {
  if (!children) return children;
  if (typeof children === "string") {
    if (/\[Source\s+\d+/.test(children)) {
      return <CitationText text={children} />;
    }
    return children;
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      const processed = processChildren(child);
      if (processed !== child && typeof processed === "object") {
        return <span key={i}>{processed}</span>;
      }
      return processed;
    });
  }
  // Recursively walk React elements (e.g., <em>, <strong>, <a>)
  if (React.isValidElement(children)) {
    const props = children.props as Record<string, unknown>;
    if (props.children) {
      const processedChildren = processChildren(props.children as React.ReactNode);
      if (processedChildren !== props.children) {
        return React.cloneElement(children, {}, processedChildren);
      }
    }
  }
  return children;
}

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
      // Treat this oversized SELECT block as plain text and continue parsing after it.
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
        // Radio: only one at a time
        if (next.has(idx)) {
          next.delete(idx);
        } else {
          next.clear();
          next.add(idx);
        }
      } else {
        // Checkbox: toggle
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
      className="my-2 space-y-2"
      role={type === "single" ? "radiogroup" : "group"}
      aria-label={t("selectionOptions")}
    >
      {options.map((option, idx) => {
        const isSelected = selected.has(idx);
        return (
          <button
            key={idx}
            type="button"
            role={type === "single" ? "radio" : "checkbox"}
            aria-checked={isSelected}
            disabled={confirmed || disabled}
            onClick={() => toggle(idx)}
            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            } ${confirmed ? "opacity-70 cursor-default" : "cursor-pointer"}`}
          >
            {type === "multi" ? (
              <Checkbox
                checked={isSelected}
                className="mt-0.5 pointer-events-none"
                tabIndex={-1}
              />
            ) : (
              <div
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground"
                }`}
              >
                {isSelected && <Circle className="h-2 w-2 fill-primary-foreground text-primary-foreground" />}
              </div>
            )}
            <span className="text-sm leading-relaxed">{option}</span>
          </button>
        );
      })}
      {!confirmed && (
        <Button
          size="sm"
          disabled={selected.size === 0 || disabled}
          onClick={handleConfirm}
          className="mt-1"
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          {t("confirmSelection")}
        </Button>
      )}
      {confirmed && (
        <p className="text-xs text-muted-foreground">
          {t("selectionConfirmed")}
        </p>
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
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {segments.map((seg) =>
        seg.type === "text" ? (
          <ReactMarkdown key={`${messageId}-t${seg.offset}`} components={markdownComponents}>{seg.content}</ReactMarkdown>
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const { data: settings } = useSWR("/api/settings", fetcher);
  const aiEnabled = settings?.hasAIKey ?? false;

  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({
      api: "/api/chat",
      body: { workspaceId },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

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
    if (!text || isLoading || !aiEnabled) return;
    setInput("");
    await sendMessage({ text });
  };

  const getMessageText = (message: (typeof messages)[number]) => {
    return message.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";
  };

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
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
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
                    <p>{getMessageText(message)}</p>
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
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={aiEnabled ? t("placeholder") : t("disabledState")}
            className="min-h-[40px] max-h-[120px] resize-none"
            rows={1}
            disabled={!aiEnabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button size="icon" disabled={!aiEnabled || isLoading || !input.trim()} onClick={handleSend}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
