"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
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
  Brain,
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
import { getOverflowThresholdChars, getMessageTextLength } from "@/lib/ai/models";
import { SkillAutocomplete } from "@/components/skills/skill-autocomplete";
import { SkillParameterDialog } from "@/components/skills/skill-parameter-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    <div className="my-1.5 rounded border border-agent-border bg-agent-card-bg text-xs font-mono overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-agent-card-hover transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-agent-muted" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-agent-muted" />
        )}
        <span className="text-agent-accent">{icon}</span>
        <span className="font-semibold text-agent-accent">{toolName}</span>
        <span className="text-agent-muted truncate flex-1">{summary}</span>
        {isRunning && (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-agent-accent" />
        )}
        {isDone && !isError && (
          <Check className="h-3 w-3 shrink-0 text-agent-success" />
        )}
        {isDone && isError && (
          <AlertCircle className="h-3 w-3 shrink-0 text-agent-error" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-agent-border px-3 py-2 space-y-2">
          {/* Tool-specific rendering */}
          {toolName === "bash" && args && (
            <div className="text-agent-success">$ {String(args.command)}</div>
          )}
          {toolName === "readFile" && args && (
            <div className="text-agent-muted">
              Reading: {String(args.filePath)}
            </div>
          )}
          {toolName === "writeFile" && args && (
            <div className="text-agent-muted">
              Writing: {String(args.filePath)}
            </div>
          )}
          {toolName === "grep" && args && (
            <div className="text-agent-muted">
              Pattern: {String(args.pattern)}
              {args.include ? ` | Include: ${String(args.include)}` : null}
            </div>
          )}
          {toolName === "kubectl" && args && (
            <div className="text-agent-success">
              $ {args.useVcctl ? "vcctl" : "kubectl"} {String(args.subcommand)}
              {!args.useVcctl && args.namespace ? ` -n ${String(args.namespace)}` : ""}
            </div>
          )}
          {toolName === "submitK8sJob" && args && (
            <div className="text-agent-muted space-y-0.5">
              <div>Job: <span className="text-agent-accent">{String(args.jobName)}</span> | Image: <span className="text-agent-foreground">{String(args.image || "default")}</span> | GPUs: <span className="text-agent-purple">{String(args.gpuCount || 4)}</span></div>
              <div className="text-agent-success">$ {String(args.command)}</div>
            </div>
          )}
          {toolName === "collectJobResults" && args && (
            <div className="text-agent-muted space-y-0.5">
              <div>📋 Collecting results for: <span className="text-agent-accent">{String(args.jobName)}</span></div>
              {args.namespace ? <div>Namespace: <span className="text-agent-foreground">{String(args.namespace)}</span></div> : null}
            </div>
          )}

          {/* Error */}
          {isError && part.errorText && (
            <div className="text-agent-error">{part.errorText}</div>
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
            <pre className="whitespace-pre-wrap text-agent-foreground leading-relaxed">
              {stdout}
            </pre>
          )}
          {stderr && (
            <pre className="whitespace-pre-wrap text-agent-error leading-relaxed">
              {stderr}
            </pre>
          )}
          {exitCode !== 0 && (
            <div className="text-agent-error">Exit code: {exitCode}</div>
          )}
        </div>
      );
    }
    case "readFile":
      return (
        <pre className="whitespace-pre-wrap text-agent-foreground leading-relaxed">
          {String(result.content || "")}
        </pre>
      );
    case "writeFile":
      return (
        <div className="text-agent-success">
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
                  e.type === "directory" ? "text-agent-accent" : "text-agent-foreground"
                }
              >
                {e.type === "directory" ? "📁" : "📄"} {e.name}
              </span>
              {e.type === "file" && (
                <span className="text-agent-muted">
                  {e.size > 1024
                    ? `${(e.size / 1024).toFixed(1)}KB`
                    : `${e.size}B`}
                </span>
              )}
            </div>
          ))}
          {Number(result.total || 0) > entries.length && (
            <div className="text-agent-muted">
              ... and {Number(result.total) - entries.length} more
            </div>
          )}
        </div>
      );
    }
    case "grep":
      return (
        <pre className="whitespace-pre-wrap text-agent-foreground leading-relaxed">
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
            <pre className="whitespace-pre-wrap text-agent-foreground leading-relaxed">
              {kStdout}
            </pre>
          )}
          {kStderr && (
            <pre className="whitespace-pre-wrap text-agent-error leading-relaxed">
              {kStderr}
            </pre>
          )}
          {kExitCode !== 0 && (
            <div className="text-agent-error">Exit code: {kExitCode}</div>
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
          <div className={success ? "text-agent-success" : "text-agent-error"}>
            {success ? "Job submitted successfully" : "Job submission failed"}
            {result.jobName ? ` — ${String(result.jobName)}` : ""}
          </div>
          {sStdout && (
            <pre className="whitespace-pre-wrap text-agent-foreground leading-relaxed">
              {sStdout}
            </pre>
          )}
          {sStderr && (
            <pre className="whitespace-pre-wrap text-agent-error leading-relaxed">
              {sStderr}
            </pre>
          )}
          {result.error != null && (
            <div className="text-agent-error">{String(result.error)}</div>
          )}
        </div>
      );
    }
    case "collectJobResults": {
      const crSuccess = Boolean(result.success);
      const crLogs = String(result.logs || "");
      const crJobStatus = result.jobStatus as Record<string, unknown> | undefined;
      return (
        <div className="space-y-1">
          <div className={crSuccess ? "text-agent-success" : "text-agent-error"}>
            {crSuccess ? "Results collected" : "Failed to collect results"}
            {result.jobName ? ` — ${String(result.jobName)}` : ""}
          </div>
          {crJobStatus && (
            <div className="text-agent-muted text-xs">
              Active: {String(crJobStatus.active ?? 0)} | Succeeded: {String(crJobStatus.succeeded ?? 0)} | Failed: {String(crJobStatus.failed ?? 0)}
            </div>
          )}
          {crLogs && (
            <pre className="whitespace-pre-wrap text-agent-foreground leading-relaxed max-h-[400px] overflow-auto">
              {crLogs}
            </pre>
          )}
          {result.logsError ? (
            <pre className="whitespace-pre-wrap text-agent-error leading-relaxed">
              {String(result.logsError)}
            </pre>
          ) : null}
        </div>
      );
    }
    default:
      return (
        <pre className="whitespace-pre-wrap text-agent-foreground">
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
        <span className="text-agent-purple shrink-0 font-bold select-none">
          &gt;
        </span>
        <span className="text-agent-foreground whitespace-pre-wrap">{text}</span>
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
              className="prose prose-sm max-w-none text-agent-foreground [&_p]:my-1 [&_pre]:bg-agent-card-bg [&_pre]:border [&_pre]:border-agent-border [&_code]:text-agent-code [&_h1]:text-agent-foreground [&_h2]:text-agent-foreground [&_h3]:text-agent-foreground [&_a]:text-agent-accent [&_strong]:text-agent-foreground dark:prose-invert"
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
            <details key={i} className="text-agent-muted text-xs">
              <summary className="cursor-pointer hover:text-agent-accent">
                Thinking...
              </summary>
              <pre className="whitespace-pre-wrap mt-1 pl-2 border-l border-agent-border">
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
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AgentMode>("agent");

  // Skills state
  const { skills: availableSkills } = useSkills(workspaceId);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [showParamDialog, setShowParamDialog] = useState(false);

  // Auto-memory state
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summarizingRef = useRef(false);
  const failedAtCountRef = useRef(-1);

  // Memory preview dialog state
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

  // Draggable + resizable dialog state
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 });
  const [dialogSize, setDialogSize] = useState({ width: 512, height: 520 });
  const [isDragging, setIsDragging] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<string | null>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0, posX: 0, posY: 0 });

  // Reset dialog position/size when opened
  useEffect(() => {
    if (showMemoryPreview) {
      setDialogPos({ x: 0, y: 0 });
      setDialogSize({ width: 512, height: 520 });
    }
  }, [showMemoryPreview]);

  // Global pointer listeners for dragging
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const s = dragStartRef.current;
      setDialogPos({ x: s.posX + e.clientX - s.mouseX, y: s.posY + e.clientY - s.mouseY });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging]);

  // Global pointer listeners for resizing (all edges/corners)
  useEffect(() => {
    if (!resizeEdge) return;
    const onMove = (e: PointerEvent) => {
      const s = resizeStartRef.current;
      const dx = e.clientX - s.mouseX;
      const dy = e.clientY - s.mouseY;
      let newW = s.w, newH = s.h, newX = s.posX, newY = s.posY;

      if (resizeEdge.includes("e")) newW = s.w + dx;
      if (resizeEdge.includes("w")) { newW = s.w - dx; newX = s.posX + dx; }
      if (resizeEdge.includes("s")) newH = s.h + dy;
      if (resizeEdge.includes("n")) { newH = s.h - dy; newY = s.posY + dy; }

      // Enforce minimums and clamp position
      if (newW < 360) { newW = 360; if (resizeEdge.includes("w")) newX = s.posX + s.w - 360; }
      if (newH < 300) { newH = 300; if (resizeEdge.includes("n")) newY = s.posY + s.h - 300; }

      setDialogSize({ width: newW, height: newH });
      setDialogPos({ x: newX, y: newY });
    };
    const onUp = () => setResizeEdge(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizeEdge]);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    // Don't drag when clicking close button or inputs
    if ((e.target as HTMLElement).closest("button")) return;
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX: dialogPos.x, posY: dialogPos.y };
    setIsDragging(true);
  }, [dialogPos]);

  const onEdgeResizeStart = useCallback((e: React.PointerEvent, edge: string) => {
    e.stopPropagation();
    resizeStartRef.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      w: dialogSize.width, h: dialogSize.height,
      posX: dialogPos.x, posY: dialogPos.y,
    };
    setResizeEdge(edge);
  }, [dialogSize, dialogPos]);

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

  // Scrub any in-progress tool invocations to a terminal state.
  // Used after stop(), on restore from localStorage, and after overflow eviction.
  function scrubStuckToolParts(msgs: UIMessage[]): UIMessage[] {
    const isToolPart = (type?: string) =>
      type !== undefined && (type.startsWith("tool-") || type === "dynamic-tool");
    const isStuck = (p: { type?: string; state?: string; input?: unknown }) =>
      isToolPart(p.type) && (
        (p.state && p.state !== "output-available" && p.state !== "output-error") ||
        p.input === undefined
      );

    const needsScrub = msgs.some((msg) =>
      msg.parts?.some((part) => isStuck(part as { type?: string; state?: string; input?: unknown }))
    );
    if (!needsScrub) return msgs;
    return msgs.map((msg) => ({
      ...msg,
      parts: msg.parts?.map((part) => {
        if (isStuck(part as { type?: string; state?: string; input?: unknown })) {
          return { ...part, state: "output-error", input: (part as Record<string, unknown>).input ?? {}, errorText: "Stopped" };
        }
        return part;
      }),
    })) as UIMessage[];
  }

  const { messages, sendMessage, setMessages, stop, status, error: chatError } = useChat({ transport });

  // --- Message persistence via localStorage ---
  const storageKey = `agent-messages:${workspaceId}:${mode}`;
  // Counter-based gate: incremented on restore, decremented in the save effect
  // that sees the restored messages. Avoids save-during-restore race.
  const restoreGenRef = useRef(0);

  // Restore messages from localStorage on mount / workspace change / mode change
  useEffect(() => {
    restoreGenRef.current++;
    let restored: UIMessage[] = [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as UIMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          restored = scrubStuckToolParts(parsed);
        }
      }
    } catch {
      // ignore corrupt data; fall back to empty conversation
    }
    // Always set messages for this storageKey, even if nothing was restored
    setMessages(restored);
  }, [storageKey, setMessages]);

  // Save messages to localStorage on meaningful changes.
  // Skip during restore (counter-gated) and during streaming (too frequent).
  // Persist when streaming completes (status === "ready") or when messages change while idle.
  useEffect(() => {
    if (restoreGenRef.current > 0) {
      // This render was triggered by the restore above — skip, then clear the gate
      restoreGenRef.current--;
      return;
    }
    // Don't persist mid-stream — wait for completion
    if (status === "streaming" || status === "submitted") return;
    try {
      if (messages.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
      // Notify same-tab listeners (StorageEvent only fires cross-tab)
      window.dispatchEvent(new CustomEvent("agent-messages-updated", { detail: { key: storageKey } }));
    } catch {
      // storage full or unavailable — silently ignore
    }
  }, [messages, storageKey, status]);

  // --- Auto-continue: automatically continue when task is incomplete ---
  const prevStatusRef = useRef(status);
  const autoContinueCountRef = useRef(0);
  const autoContinueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_AUTO_CONTINUES = 5; // Prevent infinite loops

  useEffect(() => {
    const wasStreaming = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    const isNowReady = status === "ready";
    prevStatusRef.current = status;

    // Only trigger on transition from streaming to ready
    if (!wasStreaming || !isNowReady) {
      // Reset counter when user sends a new message
      if (status === "submitted") {
        autoContinueCountRef.current = 0;
      }
      return;
    }

    // Check if we've hit the auto-continue limit
    if (autoContinueCountRef.current >= MAX_AUTO_CONTINUES) {
      return;
    }

    // Check if the last assistant message ends with a tool call (task incomplete)
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    const parts = lastMessage.parts || [];
    const hasToolCall = parts.some((p: { type?: string }) =>
      p.type?.startsWith("tool-") || p.type === "dynamic-tool"
    );

    // If the last part is a tool call result, the agent was likely interrupted mid-task
    if (hasToolCall) {
      const lastPart = parts[parts.length - 1] as { type?: string };
      const endsWithTool = lastPart?.type?.startsWith("tool-") || lastPart?.type === "dynamic-tool";

      if (endsWithTool) {
        autoContinueCountRef.current++;
        autoContinueTimerRef.current = setTimeout(() => {
          sendMessage({ text: t("autoContinue") });
        }, 500);
      }
    }

    return () => {
      if (autoContinueTimerRef.current) {
        clearTimeout(autoContinueTimerRef.current);
        autoContinueTimerRef.current = null;
      }
    };
  }, [status, messages, sendMessage, t]);
  const overflowThreshold = getOverflowThresholdChars(
    settings?.llmProvider ?? "openai",
    settings?.llmModel ?? "gpt-4o-mini",
    settings?.contextMode ?? "normal"
  );

  const summarizeAndEvict = async (
    messagesToSummarize: UIMessage[],
    messagesToKeep: UIMessage[],
    trigger: "overflow" | "clear"
  ) => {
    if (summarizingRef.current) return;
    summarizingRef.current = true;
    failedAtCountRef.current = -1;
    setIsSummarizing(true);
    setSummaryError(null);

    try {
      const res = await fetch("/api/agent/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          messages: messagesToSummarize,
          trigger,
          locale,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Summarization failed" }));
        throw new Error(errData.error || "Summarization failed");
      }

      if (trigger === "clear") {
        setMessages([]);
      } else {
        // Inject a marker message indicating memory was saved
        const memoryMarker = {
          id: `memory-${Date.now()}`,
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: t("memorySaved") }],
        } as UIMessage;
        setMessages([memoryMarker, ...messagesToKeep]);
      }
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Summarization failed");
      // On failure: do NOT evict messages; record count to prevent infinite retry
      if (trigger === "overflow") {
        failedAtCountRef.current = messagesToSummarize.length + messagesToKeep.length;
      }
    } finally {
      setIsSummarizing(false);
      summarizingRef.current = false;
    }
  };

  // Detect context overflow after messages stabilize (not during streaming)
  useEffect(() => {
    if (settings?.maxMode === false) return;
    if (restoreGenRef.current > 0 || isSummarizing) return;
    if (showMessageSelect || showMemoryPreview) return; // Don't trigger while dialog is open
    if (status !== "ready" && status !== "error") return;
    if (messages.length < 4) return;
    if (messages.length === failedAtCountRef.current) return;

    // Pre-compute per-message sizes once to avoid repeated serialization
    const messageSizes = messages.map((m) => getMessageTextLength(m));
    const totalChars = messageSizes.reduce((sum, s) => sum + s, 0);
    if (totalChars <= overflowThreshold) return;

    // Find split point: keep newest ~20% by character count
    let keepFromIndex = messages.length;
    let accumulatedChars = 0;
    const targetKeepChars = totalChars * 0.2;

    for (let i = messages.length - 1; i >= 0; i--) {
      accumulatedChars += messageSizes[i];
      if (accumulatedChars >= targetKeepChars) {
        keepFromIndex = i;
        break;
      }
    }

    // Keep at least the last 2 messages
    keepFromIndex = Math.min(keepFromIndex, messages.length - 2);
    if (keepFromIndex <= 0) return;

    const toSummarize = messages.slice(0, keepFromIndex);
    const toKeep = messages.slice(keepFromIndex);

    // Show message selection dialog instead of auto-summarizing
    overflowKeepRef.current = toKeep;
    // Only pre-select messages with renderable text content
    setSelectedMessageIds(new Set(
      toSummarize.filter((m) => getMessageTextLength(m) > 0).map((m) => m.id)
    ));
    setShowMessageSelect(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, isSummarizing, showMessageSelect, showMemoryPreview]);

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

    try {
      await sendMessage({
        text: `/${skill.slug}${Object.keys(paramValues).length > 0 ? " " + Object.entries(paramValues).map(([k, v]) => `${k}="${v}"`).join(" ") : ""}`,
      });
    } finally {
      // Clear skill context after sending, even if sendMessage throws
      delete agentBody.skillId;
      delete agentBody.paramValues;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || !aiEnabled || isSummarizing) return;

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
    // Scrub incomplete tool parts so the next sendMessage works cleanly
    // Use setTimeout to let useChat process the abort first
    setTimeout(() => {
      setMessages((prev) => scrubStuckToolParts(prev));
    }, 100);
  };

  // Helper: extract plain text from a message
  const getMessageText = (message: UIMessage) =>
    message.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";

  // Messages that have renderable text content (used for selection UI)
  const selectableMessages = useMemo(
    () => messages.filter((m) => getMessageTextLength(m) > 0),
    [messages]
  );

  const handleClear = () => {
    if (status === "streaming" || status === "submitted") stop();
    if (messages.length > 0 && aiEnabled) {
      // Show message selection dialog first
      overflowKeepRef.current = null; // null = manual clear (not overflow)
      setSelectedMessageIds(new Set(selectableMessages.map((m) => m.id)));
      setShowMessageSelect(true);
    } else {
      setMessages([]);
    }
    setInput("");
  };

  // Step 2: generate preview from selected messages
  const handleSelectNext = async () => {
    setShowMessageSelect(false);
    const selected = messages.filter((m) => selectedMessageIds.has(m.id));
    if (selected.length === 0) return;

    setIsSummarizing(true);
    setSummaryError(null);
    try {
      const res = await fetch("/api/agent/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          messages: selected,
          trigger: "clear",
          preview: true,
          locale,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Summarization failed" }));
        throw new Error(errData.error || "Summarization failed");
      }
      const data = await res.json();
      setMemoryPreviewTitle(data.title);
      setMemoryPreviewContent(data.content);
      setShowMemoryPreview(true);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Summarization failed");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSelectCancel = () => {
    setShowMessageSelect(false);
    setSelectedMessageIds(new Set());
    if (overflowKeepRef.current) {
      // User cancelled during overflow — fall back to silent auto-summarize
      const toKeep = overflowKeepRef.current;
      const toSummarize = messages.filter(
        (m) => !toKeep.some((k) => k.id === m.id)
      );
      overflowKeepRef.current = null;
      summarizeAndEvict(toSummarize, toKeep, "overflow");
    }
  };

  const handleMemoryConfirm = async () => {
    setShowMemoryPreview(false);
    setIsSummarizing(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: memoryPreviewTitle,
          content: memoryPreviewContent,
          type: "memory",
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errorMessage =
          errData && typeof errData.error === "string" ? errData.error : t("memoryError");
        throw new Error(errorMessage);
      }
      if (overflowKeepRef.current) {
        // Overflow: keep recent messages, inject memory marker
        const memoryMarker = {
          id: `memory-${Date.now()}`,
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: t("memorySaved") }],
        } as UIMessage;
        setMessages([memoryMarker, ...scrubStuckToolParts(overflowKeepRef.current)]);
        overflowKeepRef.current = null;
      } else {
        // Manual clear: empty all messages
        setMessages([]);
      }
    } catch (err) {
      setSummaryError(err instanceof Error && err.message ? err.message : t("memoryError"));
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleMemoryCancel = () => {
    setShowMemoryPreview(false);
    setMemoryPreviewTitle("");
    setMemoryPreviewContent("");
    if (overflowKeepRef.current) {
      // User cancelled memory preview during overflow — fall back to silent auto-summarize
      const toKeep = overflowKeepRef.current;
      const toSummarize = messages.filter(
        (m) => !toKeep.some((k) => k.id === m.id)
      );
      overflowKeepRef.current = null;
      summarizeAndEvict(toSummarize, toKeep, "overflow");
    }
  };

  // Switch mode: update body synchronously and clear stale conversation
  const handleModeChange = (newMode: AgentMode) => {
    setMode(newMode);
    agentBody.mode = newMode; // synchronous — guarantees next request uses correct mode
    setInput("");
  };

  const slashQuery = input.startsWith("/") ? input.slice(1) : "";

  return (
    <div className="flex h-full min-w-0 flex-col bg-agent-bg text-agent-foreground font-mono text-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-agent-border px-3 py-2">
        {mode === "agent" && <Bot className="h-4 w-4 text-agent-accent" />}
        {mode === "plan" && <ClipboardList className="h-4 w-4 text-agent-success" />}
        {mode === "ask" && <MessageCircleQuestion className="h-4 w-4 text-agent-purple" />}
        <span className="text-xs font-semibold text-agent-foreground">
          {t("title")}
        </span>
        <span className="text-xs text-agent-muted ml-auto truncate">
          {workspaceName}
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {!aiEnabled ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <AlertCircle className="h-8 w-8 text-agent-muted" />
              <p className="text-xs text-agent-muted max-w-xs">
                {t("disabledState")}
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <Bot className="h-8 w-8 text-agent-muted" />
              <p className="text-xs text-agent-muted max-w-xs">
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
              <div className="flex items-center gap-2 text-agent-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Thinking...</span>
              </div>
            )}

          {/* Chat error indicator */}
          {chatError && !isLoading && (
            <div className="flex items-start gap-2 text-[#f7768e] text-xs rounded border border-[#f7768e]/30 bg-[#f7768e]/5 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{chatError.message || "Request failed. Try again."}</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Memory summarization indicators */}
      {isSummarizing && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-[#30363d] bg-[#161b22] text-xs text-[#7aa2f7]">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{t("memorySaving")}</span>
        </div>
      )}
      {summaryError && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-[#30363d] bg-[#161b22] text-xs text-[#f7768e]">
          <AlertCircle className="h-3 w-3" />
          <span>{t("memoryError")}: {summaryError}</span>
          <button
            onClick={() => setSummaryError(null)}
            className="ml-auto text-[#565f89] hover:text-[#c9d1d9] text-xs"
          >
            {t("dismiss")}
          </button>
        </div>
      )}

      {/* Input area with autocomplete */}
      <div className="relative border-t border-agent-border">
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
              <button className="flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-xs text-agent-accent hover:bg-agent-card-hover transition-colors">
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
          <span className="text-agent-purple font-bold shrink-0 select-none">
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
                !e.nativeEvent.isComposing &&
                !showAutocomplete
              ) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!aiEnabled || isSummarizing}
            placeholder={aiEnabled ? t(MODE_PLACEHOLDER_KEYS[mode]) : t("disabledState")}
            className="flex-1 bg-transparent text-agent-foreground placeholder:text-agent-muted outline-none text-sm font-mono"
            autoFocus
          />
          {isLoading && (
            <button
              onClick={handleStop}
              title={t("stop")}
              className="shrink-0 p-1 rounded hover:bg-agent-card-hover text-agent-error transition-colors"
            >
              <Square className="h-4 w-4" />
            </button>
          )}
          {!isLoading && !isSummarizing && messages.length > 0 && (
            <button
              onClick={handleClear}
              title={t("clearContext")}
              className="shrink-0 p-1 rounded hover:bg-agent-card-hover text-agent-muted hover:text-agent-foreground transition-colors"
            >
              <Brain className="h-4 w-4" />
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

      {/* Message selection dialog */}
      <Dialog open={showMessageSelect} onOpenChange={(open) => {
        if (!open) handleSelectCancel();
      }}>
        <DialogContent
          className="flex flex-col !p-0 overflow-hidden"
          style={{
            width: dialogSize.width,
            height: dialogSize.height,
            maxWidth: "none",
            maxHeight: "none",
            transform: `translate(calc(-50% + ${dialogPos.x}px), calc(-50% + ${dialogPos.y}px))`,
          }}
        >
          <DialogHeader
            className="cursor-move select-none px-6 pt-6 pb-2"
            onPointerDown={onDragStart}
          >
            <DialogTitle>{t("selectMessagesTitle")}</DialogTitle>
            <DialogDescription>{t("selectMessagesDesc")}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 px-6 pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMessageIds(new Set(selectableMessages.map((m) => m.id)))}
            >
              {t("selectAll")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMessageIds(new Set())}
            >
              {t("selectNone")}
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {selectedMessageIds.size} / {selectableMessages.length}
            </span>
          </div>

          <ScrollArea className="flex-1 min-h-0 px-6">
            <div className="space-y-2 py-2 pr-4" role="listbox" aria-multiselectable="true">
              {messages.map((msg) => {
                const text = getMessageText(msg);
                if (!text) return null;
                const checked = selectedMessageIds.has(msg.id);
                return (
                  <div
                    key={msg.id}
                    role="option"
                    aria-selected={checked}
                    tabIndex={0}
                    className={`flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                      checked
                        ? "border-[#7aa2f7]/50 bg-[#7aa2f7]/5"
                        : "border-[#30363d] hover:border-[#484f58]"
                    }`}
                    onClick={() => toggleMessage(msg.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleMessage(msg.id);
                      }
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleMessage(msg.id)}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs font-medium ${
                        msg.role === "user" ? "text-[#bb9af7]" : "text-[#7aa2f7]"
                      }`}>
                        {msg.role === "user" ? t("roleUser") : t("roleAssistant")}
                      </span>
                      <p className="text-xs text-[#c9d1d9] line-clamp-3 mt-0.5 whitespace-pre-wrap">
                        {text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 pb-6 pt-2">
            <Button variant="outline" onClick={handleSelectCancel}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowMessageSelect(false);
                setSelectedMessageIds(new Set());
                setMessages([]);
              }}
            >
              {t("clearAll")}
            </Button>
            <Button onClick={handleSelectNext} disabled={selectedMessageIds.size === 0}>
              {t("nextStep")}
            </Button>
          </DialogFooter>

          {/* Edge resize handles */}
          <div className="absolute top-0 left-3 right-3 h-1.5 cursor-n-resize" onPointerDown={(e) => onEdgeResizeStart(e, "n")} />
          <div className="absolute bottom-0 left-3 right-3 h-1.5 cursor-s-resize" onPointerDown={(e) => onEdgeResizeStart(e, "s")} />
          <div className="absolute left-0 top-3 bottom-3 w-1.5 cursor-w-resize" onPointerDown={(e) => onEdgeResizeStart(e, "w")} />
          <div className="absolute right-0 top-3 bottom-3 w-1.5 cursor-e-resize" onPointerDown={(e) => onEdgeResizeStart(e, "e")} />
          {/* Corner resize handles */}
          <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" onPointerDown={(e) => onEdgeResizeStart(e, "nw")} />
          <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" onPointerDown={(e) => onEdgeResizeStart(e, "ne")} />
          <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" onPointerDown={(e) => onEdgeResizeStart(e, "sw")} />
          <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" onPointerDown={(e) => onEdgeResizeStart(e, "se")} />
        </DialogContent>
      </Dialog>

      {/* Memory preview dialog */}
      <Dialog open={showMemoryPreview} onOpenChange={(open) => {
        if (!open) handleMemoryCancel();
      }}>
        <DialogContent
          className="flex flex-col !p-0 overflow-hidden"
          style={{
            width: dialogSize.width,
            height: dialogSize.height,
            maxWidth: "none",
            maxHeight: "none",
            transform: `translate(calc(-50% + ${dialogPos.x}px), calc(-50% + ${dialogPos.y}px))`,
          }}
        >
          {/* Drag handle */}
          <DialogHeader
            className="cursor-move select-none px-6 pt-6 pb-2"
            onPointerDown={onDragStart}
          >
            <DialogTitle>{t("memoryPreviewTitle")}</DialogTitle>
            <DialogDescription>{t("memoryPreviewDesc")}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 px-6">
            <div className="space-y-4 py-2 pr-4">
              <div className="space-y-1.5">
                <Label>{t("memoryNoteTitle")}</Label>
                <Input
                  value={memoryPreviewTitle}
                  onChange={(e) => setMemoryPreviewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("memoryNoteContent")}</Label>
                <Textarea
                  value={memoryPreviewContent}
                  onChange={(e) => setMemoryPreviewContent(e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 pb-6 pt-2">
            <Button variant="outline" onClick={handleMemoryCancel}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleMemoryConfirm} disabled={!memoryPreviewTitle.trim()}>
              {tCommon("confirm")}
            </Button>
          </DialogFooter>

          {/* Edge resize handles */}
          <div className="absolute top-0 left-3 right-3 h-1.5 cursor-n-resize" onPointerDown={(e) => onEdgeResizeStart(e, "n")} />
          <div className="absolute bottom-0 left-3 right-3 h-1.5 cursor-s-resize" onPointerDown={(e) => onEdgeResizeStart(e, "s")} />
          <div className="absolute left-0 top-3 bottom-3 w-1.5 cursor-w-resize" onPointerDown={(e) => onEdgeResizeStart(e, "w")} />
          <div className="absolute right-0 top-3 bottom-3 w-1.5 cursor-e-resize" onPointerDown={(e) => onEdgeResizeStart(e, "e")} />
          {/* Corner resize handles */}
          <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" onPointerDown={(e) => onEdgeResizeStart(e, "nw")} />
          <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" onPointerDown={(e) => onEdgeResizeStart(e, "ne")} />
          <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" onPointerDown={(e) => onEdgeResizeStart(e, "sw")} />
          <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" onPointerDown={(e) => onEdgeResizeStart(e, "se")} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
