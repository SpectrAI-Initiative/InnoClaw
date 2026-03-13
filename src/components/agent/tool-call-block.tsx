"use client";

import React, { useState } from "react";
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
} from "lucide-react";

// AI SDK v6 ToolUIPart: type is "tool-{name}" or "dynamic-tool",
// properties are flat: toolCallId, state, input, output, errorText
export interface ToolInvocationPart {
  type: string;
  toolCallId: string;
  toolName?: string; // only present on "dynamic-tool" parts
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

export function getToolNameFromPart(part: ToolInvocationPart): string {
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
            <pre className="whitespace-pre-wrap text-agent-foreground leading-relaxed max-h-[400px] overflow-y-auto overflow-x-hidden">
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

export function ToolCallBlock({ part }: { part: ToolInvocationPart }) {
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
    <div className={`my-2 rounded-lg border text-xs font-mono overflow-hidden break-all transition-all duration-300 ${
      isRunning
        ? "border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
        : isError
          ? "border-destructive/30 bg-destructive/5"
          : "border-agent-border bg-agent-card-bg"
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-agent-card-hover transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-agent-muted" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-agent-muted" />
        )}
        <span className={`${isRunning ? "text-primary" : "text-agent-accent"}`}>{icon}</span>
        <span className={`font-semibold ${isRunning ? "text-primary" : "text-agent-accent"}`}>{toolName}</span>
        <span className="text-agent-muted truncate flex-1">{summary}</span>
        {isRunning && (
          <div className="flex items-center gap-2">
            <span className="text-primary/70 text-[10px]">Running</span>
            <div className="relative">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              <div className="absolute inset-0 h-4 w-4 animate-ping rounded-full bg-primary/20" />
            </div>
          </div>
        )}
        {isDone && !isError && (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-agent-success/20">
            <Check className="h-3 w-3 shrink-0 text-agent-success" />
          </div>
        )}
        {isDone && isError && (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-agent-error/20">
            <AlertCircle className="h-3 w-3 shrink-0 text-agent-error" />
          </div>
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
            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
              {renderToolResult(toolName, result)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
