"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Terminal,
  FileText,
  Pencil,
  FolderOpen,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
  Bot,
  Square,
  Trash2,
  ClipboardList,
  MessageCircleQuestion,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import useSWR from "swr";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useSkills } from "@/lib/hooks/use-skills";
import { SkillAutocomplete } from "@/components/skills/skill-autocomplete";
import { SkillParameterDialog } from "@/components/skills/skill-parameter-dialog";
import type { Skill } from "@/types";

type AgentMode = "agent" | "plan" | "ask";

const MODE_LABEL_KEYS: Record<AgentMode, "modeAgent" | "modePlan" | "modeAsk"> = {
  agent: "modeAgent",
  plan: "modePlan",
  ask: "modeAsk",
};

const MODE_PLACEHOLDER_KEYS: Record<AgentMode, "placeholder" | "placeholderPlan" | "placeholderAsk"> = {
  agent: "placeholder",
  plan: "placeholderPlan",
  ask: "placeholderAsk",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// --- Tool Call Block ---

// AI SDK v6 ToolUIPart: type is "tool-{name}" or "dynamic-tool",
// properties are flat: toolCallId, state, input, output, errorText
interface ToolInvocationPart {
  type: string;
  toolCallId: string;
  toolName?: string; // only present on "dynamic-tool" parts
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function getToolNameFromPart(part: ToolInvocationPart): string {
  if (part.toolName) return part.toolName; // dynamic-tool
  if (part.type.startsWith("tool-")) return part.type.slice(5);

  // Fallback for unexpected tool part structures to aid debugging
  console.warn(
    "[agent-panel] Unexpected tool part structure encountered in getToolNameFromPart:",
    part,
  );
  return "unknown";
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  bash: <Terminal className="h-3.5 w-3.5" />,
  readFile: <FileText className="h-3.5 w-3.5" />,
  writeFile: <Pencil className="h-3.5 w-3.5" />,
  listDirectory: <FolderOpen className="h-3.5 w-3.5" />,
  grep: <Search className="h-3.5 w-3.5" />,
  kubectl: <Terminal className="h-3.5 w-3.5" />,
  submitK8sJob: <Terminal className="h-3.5 w-3.5" />,
};

function getToolSummary(toolName: string, args?: Record<string, unknown>): string {
  if (!args) return "";
  switch (toolName) {
    case "bash":
      return String(args.command || "");
    case "readFile":
      return String(args.filePath || "");
    case "writeFile":
      return String(args.filePath || "");
    case "listDirectory":
      return String(args.dirPath || ".");
    case "grep":
      return `${args.pattern || ""}${args.include ? ` (${args.include})` : ""}`;
    case "kubectl":
      return String(args.subcommand || "");
    case "submitK8sJob":
      return `${args.jobName || ""}${args.gpuCount ? ` (${args.gpuCount} GPUs)` : ""}`;
    default:
      return JSON.stringify(args);
  }
}

function ToolCallBlock({ part }: { part: ToolInvocationPart }) {
  const [expanded, setExpanded] = useState(false);

  const toolName = getToolNameFromPart(part);
  const args = part.input as Record<string, unknown> | undefined;
  const icon = TOOL_ICONS[toolName] || <Terminal className="h-3.5 w-3.5" />;
  const summary = getToolSummary(toolName, args);
  const isDone = part.state === "output-available";
  const isError = part.state === "output-error";
  const isRunning = !isDone && !isError;
  const result = part.output as Record<string, unknown> | undefined;

  return (
    <div className="my-1.5 rounded border border-[#30363d] bg-[#161b22] text-xs font-mono overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#1c2129] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-[#565f89]" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-[#565f89]" />
        )}
        <span className="text-[#7aa2f7]">{icon}</span>
        <span className="font-semibold text-[#7aa2f7]">{toolName}</span>
        <span className="text-[#565f89] truncate flex-1">{summary}</span>
        {isRunning && (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#7aa2f7]" />
        )}
        {isDone && (
          <Check className="h-3 w-3 shrink-0 text-[#9ece6a]" />
        )}
        {isError && (
          <AlertCircle className="h-3 w-3 shrink-0 text-[#f7768e]" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[#30363d] px-3 py-2 space-y-2">
          {/* Tool-specific rendering */}
          {toolName === "bash" && args && (
            <div className="text-[#9ece6a]">$ {String(args.command)}</div>
          )}
          {toolName === "readFile" && args && (
            <div className="text-[#565f89]">
              Reading: {String(args.filePath)}
            </div>
          )}
          {toolName === "writeFile" && args && (
            <div className="text-[#565f89]">
              Writing: {String(args.filePath)}
            </div>
          )}
          {toolName === "grep" && args && (
            <div className="text-[#565f89]">
              Pattern: {String(args.pattern)}
              {args.include ? ` | Include: ${String(args.include)}` : null}
            </div>
          )}
          {toolName === "kubectl" && args && (
            <div className="text-[#9ece6a]">
              $ {args.useVcctl ? "vcctl" : "kubectl"} {String(args.subcommand)}
              {args.namespace ? ` -n ${String(args.namespace)}` : ""}
            </div>
          )}
          {toolName === "submitK8sJob" && args && (
            <div className="text-[#565f89] space-y-0.5">
              <div>Job: <span className="text-[#7aa2f7]">{String(args.jobName)}</span> | Image: <span className="text-[#c9d1d9]">{String(args.image || "default")}</span> | GPUs: <span className="text-[#bb9af7]">{String(args.gpuCount || 4)}</span></div>
              <div className="text-[#9ece6a]">$ {String(args.command)}</div>
            </div>
          )}

          {/* Error */}
          {isError && part.errorText && (
            <div className="text-[#f7768e]">{part.errorText}</div>
          )}

          {/* Result */}
          {isDone && result && (
            <div className="max-h-[300px] overflow-auto">
              {renderToolResult(toolName, result)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderToolResult(
  toolName: string,
  result: Record<string, unknown>
): React.ReactNode {
  switch (toolName) {
    case "bash": {
      const stdout = String(result.stdout || "");
      const stderr = String(result.stderr || "");
      const exitCode = Number(result.exitCode ?? 0);
      return (
        <div className="space-y-1">
          {stdout && (
            <pre className="whitespace-pre-wrap text-[#c9d1d9] leading-relaxed">
              {stdout}
            </pre>
          )}
          {stderr && (
            <pre className="whitespace-pre-wrap text-[#f7768e] leading-relaxed">
              {stderr}
            </pre>
          )}
          {exitCode !== 0 && (
            <div className="text-[#f7768e]">Exit code: {exitCode}</div>
          )}
        </div>
      );
    }
    case "readFile":
      return (
        <pre className="whitespace-pre-wrap text-[#c9d1d9] leading-relaxed">
          {String(result.content || "")}
        </pre>
      );
    case "writeFile":
      return (
        <div className="text-[#9ece6a]">
          Wrote {String(result.bytesWritten || 0)} bytes to{" "}
          {String(result.path || "")}
        </div>
      );
    case "listDirectory": {
      const entries = (result.entries || []) as Array<{
        name: string;
        type: string;
        size: number;
      }>;
      return (
        <div className="space-y-0.5">
          {entries.map((e, i) => (
            <div key={i} className="flex gap-2">
              <span
                className={
                  e.type === "directory" ? "text-[#7aa2f7]" : "text-[#c9d1d9]"
                }
              >
                {e.type === "directory" ? "📁" : "📄"} {e.name}
              </span>
              {e.type === "file" && (
                <span className="text-[#565f89]">
                  {e.size > 1024
                    ? `${(e.size / 1024).toFixed(1)}KB`
                    : `${e.size}B`}
                </span>
              )}
            </div>
          ))}
          {Number(result.total || 0) > entries.length && (
            <div className="text-[#565f89]">
              ... and {Number(result.total) - entries.length} more
            </div>
          )}
        </div>
      );
    }
    case "grep":
      return (
        <pre className="whitespace-pre-wrap text-[#c9d1d9] leading-relaxed">
          {String(result.matches || "No matches found")}
        </pre>
      );
    case "kubectl": {
      const kStdout = String(result.stdout || "");
      const kStderr = String(result.stderr || "");
      const kExitCode = Number(result.exitCode ?? 0);
      return (
        <div className="space-y-1">
          {kStdout && (
            <pre className="whitespace-pre-wrap text-[#c9d1d9] leading-relaxed">
              {kStdout}
            </pre>
          )}
          {kStderr && (
            <pre className="whitespace-pre-wrap text-[#f7768e] leading-relaxed">
              {kStderr}
            </pre>
          )}
          {kExitCode !== 0 && (
            <div className="text-[#f7768e]">Exit code: {kExitCode}</div>
          )}
        </div>
      );
    }
    case "submitK8sJob": {
      const success = Boolean(result.success);
      const sStdout = String(result.stdout || "");
      const sStderr = String(result.stderr || "");
      return (
        <div className="space-y-1">
          <div className={success ? "text-[#9ece6a]" : "text-[#f7768e]"}>
            {success ? "Job submitted successfully" : "Job submission failed"}
            {result.jobName ? ` — ${String(result.jobName)}` : ""}
          </div>
          {sStdout && (
            <pre className="whitespace-pre-wrap text-[#c9d1d9] leading-relaxed">
              {sStdout}
            </pre>
          )}
          {sStderr && (
            <pre className="whitespace-pre-wrap text-[#f7768e] leading-relaxed">
              {sStderr}
            </pre>
          )}
          {result.error ? (
            <div className="text-[#f7768e]">{String(result.error)}</div>
          ) : null}
        </div>
      );
    }
    default:
      return (
        <pre className="whitespace-pre-wrap text-[#c9d1d9]">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
  }
}

// --- Agent Message ---

function AgentMessage({ message }: { message: UIMessage }) {
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
      <div className="flex gap-2 items-start">
        <span className="text-[#bb9af7] shrink-0 font-bold select-none">
          &gt;
        </span>
        <span className="text-[#c9d1d9] whitespace-pre-wrap">{text}</span>
      </div>
    );
  }

  // Assistant message — render parts
  return (
    <div className="space-y-1 pl-0">
      {message.parts?.map((part, i) => {
        if (part.type === "text") {
          const text = (part as { type: "text"; text: string }).text;
          if (!text.trim()) return null;
          return (
            <div
              key={i}
              className="prose prose-sm prose-invert max-w-none text-[#c9d1d9] [&_p]:my-1 [&_pre]:bg-[#161b22] [&_pre]:border [&_pre]:border-[#30363d] [&_code]:text-[#e6edf3] [&_h1]:text-[#c9d1d9] [&_h2]:text-[#c9d1d9] [&_h3]:text-[#c9d1d9] [&_a]:text-[#7aa2f7] [&_strong]:text-[#c9d1d9]"
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
            <details key={i} className="text-[#565f89] text-xs">
              <summary className="cursor-pointer hover:text-[#7aa2f7]">
                Thinking...
              </summary>
              <pre className="whitespace-pre-wrap mt-1 pl-2 border-l border-[#30363d]">
                {reasoning}
              </pre>
            </details>
          );
        }

        return null;
      })}
    </div>
  );
}

// --- Main Panel ---

interface AgentPanelProps {
  workspaceId: string;
  workspaceName: string;
  folderPath: string;
}

export function AgentPanel({
  workspaceId,
  workspaceName,
  folderPath,
}: AgentPanelProps) {
  const t = useTranslations("agent");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AgentMode>("agent");

  // Skills state
  const { skills: availableSkills } = useSkills(workspaceId);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [showParamDialog, setShowParamDialog] = useState(false);

  const { data: settings } = useSWR("/api/settings", fetcher);
  const aiEnabled = settings?.hasAIKey ?? false;

  // Mutable body object — allows injecting skillId/paramValues before each send
  const agentBody = useMemo(
    () =>
      ({ workspaceId, cwd: folderPath, mode: "agent" }) as Record<string, unknown>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Keep body in sync with props
  useEffect(() => {
    agentBody.workspaceId = workspaceId;
    agentBody.cwd = folderPath;
  }, [workspaceId, folderPath, agentBody]);

  // Create transport once with the mutable body reference
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: agentBody,
      }),
    [agentBody]
  );

  const { messages, sendMessage, setMessages, stop, status } = useChat({ transport });

  // Auto-clear messages when mode changes
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      setMessages([]);
    }
  }, [mode, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, status]);

  // Slash command detection
  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.startsWith("/") && value.length >= 1 && !isLoading) {
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  };

  // Skill selected from autocomplete
  const handleSkillSelect = (skill: Skill) => {
    setShowAutocomplete(false);
    setActiveSkill(skill);

    if (skill.parameters && skill.parameters.length > 0) {
      // Has parameters — show dialog to collect them
      setShowParamDialog(true);
    } else {
      // No parameters — execute immediately
      executeSkill(skill, {});
    }
  };

  // Execute skill after params are collected
  const executeSkill = async (
    skill: Skill,
    paramValues: Record<string, string>
  ) => {
    setInput("");
    setActiveSkill(null);

    // Inject skill context into the mutable body before sending
    agentBody.skillId = skill.id;
    agentBody.paramValues = paramValues;
    agentBody.mode = mode;

    await sendMessage({
      text: `/${skill.slug}${Object.keys(paramValues).length > 0 ? " " + Object.entries(paramValues).map(([k, v]) => `${k}="${v}"`).join(" ") : ""}`,
    });

    // Clear skill context after sending
    delete agentBody.skillId;
    delete agentBody.paramValues;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || !aiEnabled) return;

    // Check if input matches a skill slug
    if (text.startsWith("/")) {
      const query = text.slice(1).toLowerCase();
      const enabledMatches = availableSkills.filter(
        (s) => s.isEnabled && s.slug === query
      );
      if (enabledMatches.length === 1) {
        setShowAutocomplete(false);
        handleSkillSelect(enabledMatches[0]);
        return;
      } else if (enabledMatches.length > 1) {
        // Prefer workspace-specific skill over global when slugs collide
        const workspaceMatch = enabledMatches.find((s) => s.workspaceId);
        const matchedSkill = workspaceMatch || enabledMatches[0];
        setShowAutocomplete(false);
        handleSkillSelect(matchedSkill);
        return;
      }
    }

    setInput("");
    setShowAutocomplete(false);
    agentBody.mode = mode; // ensure mode is current before every request
    await sendMessage({ text });
  };

  const handleStop = () => {
    stop();
  };

  const handleClear = () => {
    setMessages([]);
    setInput("");
  };

  // Switch mode: update body synchronously and clear stale conversation
  const handleModeChange = (newMode: AgentMode) => {
    setMode(newMode);
    agentBody.mode = newMode; // synchronous — guarantees next request uses correct mode
    setMessages([]);
    setInput("");
  };

  const slashQuery = input.startsWith("/") ? input.slice(1) : "";

  return (
    <div className="flex h-full min-w-0 flex-col bg-[#0d1117] text-[#c9d1d9] font-mono text-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#30363d] px-3 py-2">
        {mode === "agent" && <Bot className="h-4 w-4 text-[#7aa2f7]" />}
        {mode === "plan" && <ClipboardList className="h-4 w-4 text-[#9ece6a]" />}
        {mode === "ask" && <MessageCircleQuestion className="h-4 w-4 text-[#bb9af7]" />}
        <span className="text-xs font-semibold text-[#c9d1d9]">
          {t("title")}
        </span>
        <span className="text-xs text-[#565f89] ml-auto truncate">
          {workspaceName}
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {!aiEnabled ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <AlertCircle className="h-8 w-8 text-[#565f89]" />
              <p className="text-xs text-[#565f89] max-w-xs">
                {t("disabledState")}
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <Bot className="h-8 w-8 text-[#565f89]" />
              <p className="text-xs text-[#565f89] max-w-xs">
                {t("emptyState")}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <AgentMessage key={message.id} message={message} />
            ))
          )}

          {/* Loading indicator */}
          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <div className="flex items-center gap-2 text-[#565f89]">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Thinking...</span>
              </div>
            )}
        </div>
      </ScrollArea>

      {/* Input area with autocomplete */}
      <div className="relative border-t border-[#30363d]">
        {/* Slash command autocomplete */}
        {showAutocomplete && availableSkills.length > 0 && (
          <SkillAutocomplete
            query={slashQuery}
            skills={availableSkills}
            onSelect={handleSkillSelect}
            onClose={() => setShowAutocomplete(false)}
          />
        )}

        <div className="flex items-center gap-2 px-3 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-xs text-[#7aa2f7] hover:bg-[#30363d] transition-colors">
                {t(MODE_LABEL_KEYS[mode])}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-xs">{t("modeLabel")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={mode} onValueChange={(v) => handleModeChange(v as AgentMode)}>
                <DropdownMenuRadioItem value="agent">
                  <div className="flex flex-col">
                    <span>{t("modeAgent")}</span>
                    <span className="text-xs text-muted-foreground">{t("modeAgentDesc")}</span>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="plan">
                  <div className="flex flex-col">
                    <span>{t("modePlan")}</span>
                    <span className="text-xs text-muted-foreground">{t("modePlanDesc")}</span>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ask">
                  <div className="flex flex-col">
                    <span>{t("modeAsk")}</span>
                    <span className="text-xs text-muted-foreground">{t("modeAskDesc")}</span>
                  </div>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-[#bb9af7] font-bold shrink-0 select-none">
            &gt;
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !showAutocomplete
              ) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!aiEnabled}
            placeholder={aiEnabled ? t(MODE_PLACEHOLDER_KEYS[mode]) : t("disabledState")}
            className="flex-1 bg-transparent text-[#c9d1d9] placeholder:text-[#565f89] outline-none text-sm font-mono"
            autoFocus
          />
          {isLoading && (
            <button
              onClick={handleStop}
              title={t("stop")}
              className="shrink-0 p-1 rounded hover:bg-[#30363d] text-[#f7768e] transition-colors"
            >
              <Square className="h-4 w-4" />
            </button>
          )}
          {!isLoading && messages.length > 0 && (
            <button
              onClick={handleClear}
              title={t("clearContext")}
              className="shrink-0 p-1 rounded hover:bg-[#30363d] text-[#565f89] hover:text-[#c9d1d9] transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Skill parameter dialog */}
      {activeSkill && (
        <SkillParameterDialog
          open={showParamDialog}
          onOpenChange={(open) => {
            setShowParamDialog(open);
            if (!open) setActiveSkill(null);
          }}
          skill={activeSkill}
          onSubmit={(paramValues) => executeSkill(activeSkill, paramValues)}
        />
      )}
    </div>
  );
}
