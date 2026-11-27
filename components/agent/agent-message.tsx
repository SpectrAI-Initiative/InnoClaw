"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, Brain, ChevronDown, ChevronRight, Copy, Download, Share2, FileText, Code2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import { ToolCallBlock } from "./tool-call-block";
import type { ToolInvocationPart } from "./tool-call-block";
import { BreathingBorder, ThinkingParticles } from "@/components/ui/particle-effect";
import {
  remarkPlugins,
  rehypePlugins,
  markdownComponents,
} from "@/lib/markdown/shared-components";
import { getImageFileParts } from "@/lib/ai/message-attachments";
import { ImageAttachmentGrid } from "@/components/ui/image-attachment-grid";
import { toast } from "sonner";
import { conclusionFilesFromToolParts } from "@/lib/shell/conclusion-files";

/** XML tag used to identify compacted context summary messages. */
const CONTEXT_SUMMARY_TAG_PREFIX = "<context_summary>";

/** Pre-compiled regex for extracting summary content and notice. */
const CONTEXT_SUMMARY_RE = /<context_summary>\n?([\s\S]*?)\n?<\/context_summary>\n?([\s\S]*)/;

/** Check if a user message is a context summary (compacted context). */
function isContextSummaryMessage(text: string): boolean {
  return text.trimStart().startsWith(CONTEXT_SUMMARY_TAG_PREFIX);
}

/** Extract summary content and notice from a context summary message. */
function parseContextSummary(text: string): { summary: string; notice: string } {
  const match = text.match(CONTEXT_SUMMARY_RE);
  if (!match) return { summary: text, notice: "" };
  return { summary: match[1].trim(), notice: match[2].trim() };
}

/** Renders a compacted context summary as a collapsible panel. */
function ContextSummaryBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const { summary, notice } = parseContextSummary(text);

  return (
    <div className="animate-slide-in-up">
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-purple-500/10 transition-colors"
        >
          <Brain className="h-4 w-4 text-purple-400 shrink-0" />
          <span className="text-xs font-medium text-purple-400 flex-1">
            {notice || "Context Summary"}
          </span>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-purple-400/60" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-purple-400/60" />
          )}
        </button>
        {expanded && (
          <div className="px-3 pb-3 border-t border-purple-500/20">
            <div className="mt-2 chat-prose max-w-none text-agent-foreground/80 [&_p]:my-1 [&_h3]:text-purple-300 [&_h3]:text-xs [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:my-1 [&_li]:my-0 [&_li]:text-xs [&_pre]:bg-agent-card-bg [&_pre]:border [&_pre]:border-agent-border [&_pre]:rounded-lg [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:text-agent-code [&_code]:break-all dark:prose-invert text-xs leading-relaxed">
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >{summary}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 截图对齐：白底文档流里的结论文件卡片 */
function ShellFileCard({ file, index, onOpenFile }: { file: { path: string; name: string }; index: number; onOpenFile?: (path: string) => void }) {
  const isHtml = /\.html$/i.test(file.name);
  return (
    <div className="cf-msg" role="button" tabIndex={0} onClick={() => onOpenFile?.(file.path)} onKeyDown={(e) => { if (e.key === "Enter") onOpenFile?.(file.path); }}>
      <span className="cfm-ic">{isHtml ? <Code2 /> : <FileText />}</span>
      <span className="cfm-meta">
        <span className="cfm-nm">{file.name}{index === 0 && !isHtml && <span className="cfm-new">结论更新</span>}</span>
        <span className="cfm-sz">{isHtml ? "HTML · 本地文件" : "Markdown · 本地文件"}</span>
      </span>
      <span className="cfm-acts">
        <button className="cfm-ab" type="button" aria-label="复制名称" title="复制名称" onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(file.name).then(() => toast.success("已复制文件名")); }}><Copy /></button>
        <button className="cfm-ab" type="button" aria-label="打开预览" title="打开预览" onClick={(e) => { e.stopPropagation(); onOpenFile?.(file.path); }}><Download /></button>
        <button className="cfm-ab" type="button" aria-label="分享" title="分享" onClick={(e) => { e.stopPropagation(); toast("已生成分享链接（演示）"); }}><Share2 /></button>
      </span>
    </div>
  );
}

export function AgentMessage({
  message,
  onOpenFile,
  shell = false,
  folderPath,
}: {
  message: UIMessage;
  onOpenFile?: (path: string) => void;
  shell?: boolean;
  folderPath?: string;
}) {
  const t = useTranslations("agent");
  const tShell = useTranslations("shell");
  const isUser = message.role === "user";

  if (isUser) {
    const text =
      message.parts
        ?.filter(
          (p): p is { type: "text"; text: string } => p.type === "text"
        )
        .map((p) => p.text)
        .join("") ?? "";

    // Render context summary messages with special UI
    if (isContextSummaryMessage(text)) {
      return <ContextSummaryBlock text={text} />;
    }

    if (shell) {
      return (
        <div className="ib-ask animate-slide-in-up">
          <ImageAttachmentGrid attachments={getImageFileParts(message)} imageClassName="h-32 w-32" removeLabel={t("removeImage")} />
          {text ? <div className="ib-ask-t">{text}</div> : null}
        </div>
      );
    }

    return (
      <div className="group flex gap-3 items-start justify-end animate-slide-in-up">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-blue-500/25 border border-blue-500/35 hover:border-blue-500/50 transition-all duration-300 shadow-sm shadow-blue-500/10">
          <div className="space-y-2">
            <ImageAttachmentGrid
              attachments={getImageFileParts(message)}
              imageClassName="h-32 w-32"
              removeLabel={t("removeImage")}
            />
            {text ? (
              <span className="text-agent-foreground whitespace-pre-wrap leading-relaxed text-sm">{text}</span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Find the last reasoning part index so only it gets the active animation
  const lastReasoningIndex = message.parts
    ? message.parts.reduce((acc, part, idx) => part.type === "reasoning" ? idx : acc, -1)
    : -1;
  const conclusionFiles = onOpenFile
    ? conclusionFilesFromToolParts(
        (message.parts ?? [])
          .filter((part) => part.type.startsWith("tool-") || part.type === "dynamic-tool")
          .map((part) => part as { input?: unknown; output?: unknown }),
        folderPath,
      )
    : [];

  // 截图对齐：工作空间里的对话是白底文档流，不用头像和灰色气泡
  if (shell) {
    const nodes: React.ReactNode[] = [];
    let tools: React.ReactNode[] = [];
    const flush = () => {
      if (!tools.length) return;
      const key = `exec-${nodes.length}`;
      nodes.push(
        <div className="ib-exec" key={key}>
          <div className="ib-exec-sum"><ChevronDown className="ib-exec-cv" /><span className="ib-exec-lb">执行过程</span><span className="ib-exec-n">{tools.length} 步</span></div>
          <div className="ib-exec-body">{tools}</div>
        </div>,
      );
      tools = [];
    };
    (message.parts ?? []).forEach((part, i) => {
      if (part.type === "text") {
        flush();
        const text = (part as { type: "text"; text: string }).text;
        if (!text?.trim()) return;
        nodes.push(
          <div className="chat-prose ib-answer-text" key={i}>
            <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={markdownComponents}>{text}</ReactMarkdown>
          </div>,
        );
      } else if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
        tools.push(<ToolCallBlock key={i} part={part as unknown as ToolInvocationPart} shell />);
      } else if (part.type === "reasoning") {
        flush();
        nodes.push(
          <details className="ib-reason" key={i}>
            <summary>Thinking...</summary>
            <pre>{(part as { type: "reasoning"; text: string }).text}</pre>
          </details>,
        );
      }
    });
    flush();
    conclusionFiles.forEach((file, i) => nodes.push(<ShellFileCard key={file.path} file={file} index={i} onOpenFile={onOpenFile} />));
    return <div className="ib-answer animate-slide-in-up">{nodes}</div>;
  }

  // Assistant message — render parts
  return (
    <div className="flex gap-2.5 items-start animate-slide-in-up">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground mt-0.5">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-2 rounded-2xl rounded-tl-sm px-4 py-2.5 bg-muted/50 border border-border/60">
      {message.parts?.map((part, i) => {
        if (part.type === "text") {
          const text = (part as { type: "text"; text: string }).text;
          if (!text.trim()) return null;
          return (
            <div
              key={i}
              className="chat-prose text-sm max-w-none text-agent-foreground [&_p]:my-1.5 [&_pre]:bg-agent-card-bg [&_pre]:border [&_pre]:border-agent-border [&_pre]:rounded-lg [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:text-agent-code [&_code]:break-all [&_h1]:text-agent-foreground [&_h2]:text-agent-foreground [&_h3]:text-agent-foreground [&_a]:text-agent-accent [&_strong]:text-agent-foreground [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 dark:prose-invert"
            >
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >{text}</ReactMarkdown>
            </div>
          );
        }

        // Tool invocation parts — type starts with "tool-"
        if (
          part.type.startsWith("tool-") ||
          part.type === "dynamic-tool"
        ) {
          const previous = message.parts?.[i - 1];
          const startsExecution = !previous || !(previous.type.startsWith("tool-") || previous.type === "dynamic-tool");
          return (
            <React.Fragment key={i}>
              {startsExecution && (
                <div className="text-[12px] text-[#57574f]">{tShell("execution")}</div>
              )}
              <ToolCallBlock
                part={part as unknown as ToolInvocationPart}
              />
            </React.Fragment>
          );
        }

        // Reasoning part
        if (part.type === "reasoning") {
          const reasoning = (part as { type: "reasoning"; text: string }).text;
          const isLatest = i === lastReasoningIndex;
          return (
            <BreathingBorder key={i} isActive={isLatest}>
              <details className="text-agent-muted text-xs rounded-lg p-2 relative min-h-[60px]">
                <ThinkingParticles isActive={isLatest} />
                <summary className="cursor-pointer hover:text-agent-accent flex items-center gap-2 relative z-10">
                  <div className="relative flex items-center justify-center">
                    {/* Rotating ring */}
                    <div className="absolute h-5 w-5 animate-spin rounded-full border border-transparent border-t-purple-500/60" style={{ animationDuration: '1.5s' }} />
                    {/* Pulsing core */}
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse" />
                  </div>
                  <span className="font-medium text-purple-400">Thinking...</span>
                  <div className="flex gap-0.5 ml-1">
                    <span className="h-1 w-1 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.3s]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.15s]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-purple-400" />
                  </div>
                </summary>
                <pre className="whitespace-pre-wrap mt-2 pl-3 border-l-2 border-purple-500/30 text-agent-muted relative z-10">
                  {reasoning}
                </pre>
              </details>
            </BreathingBorder>
          );
        }

        return null;
      })}
      {conclusionFiles.map((file) => (
        <div
          key={file.path}
          role="button"
          tabIndex={0}
          onClick={() => onOpenFile?.(file.path)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onOpenFile?.(file.path);
          }}
          className="flex w-full max-w-md items-center gap-2 rounded-xl border border-[#ECECEF] bg-[#F7F7F8] px-3 py-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold">{file.name}</span>
            <span className="block truncate text-[10.5px] text-[#9A9AA0]">{file.path}</span>
          </span>
          <button
            type="button"
            className="text-[11px] text-[#57574f]"
            onClick={(event) => {
              event.stopPropagation();
              void navigator.clipboard.writeText(file.name).then(() => toast.success(tShell("copiedName")));
            }}
          >
            {tShell("copyName")}
          </button>
        </div>
      ))}
      </div>
    </div>
  );
}
