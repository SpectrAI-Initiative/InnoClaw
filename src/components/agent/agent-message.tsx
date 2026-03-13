"use client";

import React from "react";
import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import { ToolCallBlock } from "./tool-call-block";
import type { ToolInvocationPart } from "./tool-call-block";
import { BreathingBorder, ThinkingParticles } from "@/components/ui/particle-effect";

export function AgentMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    const text =
      message.parts
        ?.filter(
          (p): p is { type: "text"; text: string } => p.type === "text"
        )
        .map((p) => p.text)
        .join("") ?? "";

    return (
      <div className="group flex gap-3 items-start justify-end animate-slide-in-up">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-blue-500/25 border border-blue-500/35 hover:border-blue-500/50 transition-all duration-300 shadow-sm shadow-blue-500/10">
          <span className="text-agent-foreground whitespace-pre-wrap leading-relaxed text-sm">{text}</span>
        </div>
      </div>
    );
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
              className="prose prose-sm max-w-none text-agent-foreground [&_p]:my-1.5 [&_pre]:bg-agent-card-bg [&_pre]:border [&_pre]:border-agent-border [&_pre]:rounded-lg [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:text-agent-code [&_code]:break-all [&_h1]:text-agent-foreground [&_h2]:text-agent-foreground [&_h3]:text-agent-foreground [&_a]:text-agent-accent [&_strong]:text-agent-foreground [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 dark:prose-invert"
            >
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          );
        }

        // Tool invocation parts — type starts with "tool-"
        if (
          part.type.startsWith("tool-") ||
          part.type === "dynamic-tool"
        ) {
          return (
            <ToolCallBlock
              key={i}
              part={part as unknown as ToolInvocationPart}
            />
          );
        }

        // Reasoning part
        if (part.type === "reasoning") {
          const reasoning = (part as { type: "reasoning"; text: string }).text;
          return (
            <BreathingBorder key={i} isActive={true}>
              <details className="text-agent-muted text-xs rounded-lg p-2 relative min-h-[60px]">
                <ThinkingParticles isActive={true} />
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
      </div>
    </div>
  );
}
