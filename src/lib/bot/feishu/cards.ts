/**
 * Feishu interactive message card builders.
 *
 * Translates agent tool execution events into Feishu interactive card JSON
 * for real-time progress display and final results.
 *
 * Card format reference: https://open.feishu.cn/document/common-capabilities/message-card
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCallEvent {
  toolName: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  state: "running" | "completed" | "error";
  errorText?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum bytes for the card JSON payload (Feishu limit ~30KB, leave margin) */
const MAX_CARD_BYTES = 25_000;

/** Maximum characters for a single tool result summary */
const MAX_TOOL_SUMMARY_CHARS = 500;

/** Maximum characters for the final response text in card */
const MAX_FINAL_TEXT_CHARS = 3_000;

/** Maximum number of tool call elements shown in full detail */
const MAX_DETAILED_TOOL_CALLS = 15;

// ---------------------------------------------------------------------------
// Tool result summarization
// ---------------------------------------------------------------------------

/**
 * Summarize a tool result for display in a Feishu card.
 * Truncates output to keep card size manageable.
 */
export function summarizeToolResult(
  toolName: string,
  result: Record<string, unknown>
): string {
  const truncate = (s: string, max: number) =>
    s.length > max ? s.slice(0, max) + "..." : s;

  switch (toolName) {
    case "bash": {
      const stdout = String(result.stdout || "");
      const stderr = String(result.stderr || "");
      const exitCode = Number(result.exitCode ?? 0);
      const lines: string[] = [];
      if (exitCode !== 0) lines.push(`Exit: ${exitCode}`);
      else lines.push("Exit: 0");
      if (stdout) {
        const preview = stdout.split("\n").slice(0, 3).join("\n");
        lines.push(truncate(preview, MAX_TOOL_SUMMARY_CHARS));
      }
      if (stderr) lines.push(`stderr: ${truncate(stderr, 200)}`);
      return lines.join("\n");
    }
    case "readFile":
      return `${String(result.content || "").length} bytes read`;
    case "writeFile":
      return `Wrote ${result.bytesWritten || 0} bytes → ${result.path || ""}`;
    case "listDirectory": {
      const entries = (result.entries || []) as unknown[];
      const total = Number(result.total || entries.length);
      return `${total} entries`;
    }
    case "grep":
      return truncate(String(result.matches || "No matches"), MAX_TOOL_SUMMARY_CHARS);
    case "kubectl": {
      const stdout = String(result.stdout || "");
      const exitCode = Number(result.exitCode ?? 0);
      const preview = stdout.split("\n").slice(0, 3).join("\n");
      return `Exit: ${exitCode}\n${truncate(preview, MAX_TOOL_SUMMARY_CHARS)}`;
    }
    case "submitK8sJob":
      return result.success ? "Job submitted" : `Failed: ${result.error || "unknown"}`;
    default:
      return truncate(JSON.stringify(result), MAX_TOOL_SUMMARY_CHARS);
  }
}

// ---------------------------------------------------------------------------
// Tool call formatting for card elements
// ---------------------------------------------------------------------------

function formatToolCallMd(tc: ToolCallEvent): string {
  const args = tc.args || {};
  let header = "";

  switch (tc.toolName) {
    case "bash":
      header = `**🔧 bash** \`$ ${String(args.command || "").slice(0, 100)}\``;
      break;
    case "readFile":
      header = `**📄 readFile** \`${String(args.filePath || "")}\``;
      break;
    case "writeFile":
      header = `**✏️ writeFile** \`${String(args.filePath || "")}\``;
      break;
    case "listDirectory":
      header = `**📁 listDirectory** \`${String(args.dirPath || ".")}\``;
      break;
    case "grep":
      header = `**🔍 grep** \`${String(args.pattern || "")}\`${args.include ? ` in \`${args.include}\`` : ""}`;
      break;
    case "kubectl":
      header = `**☸️ kubectl** \`${String(args.subcommand || "")}\``;
      break;
    case "submitK8sJob":
      header = `**🚀 submitK8sJob** \`${String(args.jobName || "")}\` (${args.gpuCount || 4} GPUs)`;
      break;
    default:
      header = `**⚙️ ${tc.toolName}**`;
  }

  if (tc.state === "running") {
    return `${header}\n> ⏳ Running...`;
  }

  if (tc.state === "error") {
    return `${header}\n> ❌ ${tc.errorText || "Error"}`;
  }

  // Completed
  if (tc.result) {
    const summary = summarizeToolResult(tc.toolName, tc.result);
    return `${header}\n> ✅ ${summary}`;
  }

  return `${header}\n> ✅ Done`;
}

// ---------------------------------------------------------------------------
// Card size management
// ---------------------------------------------------------------------------

function cardJsonSize(card: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(card), "utf-8");
}

// ---------------------------------------------------------------------------
// Public card builders
// ---------------------------------------------------------------------------

/**
 * Build a progress card showing tool execution in progress.
 */
export function buildProgressCard(options: {
  toolCalls: ToolCallEvent[];
  currentStep: number;
  maxSteps: number;
  workspace?: string;
}): Record<string, unknown> {
  const { toolCalls, currentStep, maxSteps, workspace } = options;

  const elements: Record<string, unknown>[] = [];

  // Collapse older tool calls if too many
  const startIdx = Math.max(0, toolCalls.length - MAX_DETAILED_TOOL_CALLS);
  if (startIdx > 0) {
    elements.push({
      tag: "div",
      text: {
        content: `... ${startIdx} previous tool calls completed`,
        tag: "lark_md",
      },
    });
    elements.push({ tag: "hr" });
  }

  // Show detailed tool calls
  for (let i = startIdx; i < toolCalls.length; i++) {
    elements.push({
      tag: "div",
      text: { content: formatToolCallMd(toolCalls[i]), tag: "lark_md" },
    });
    if (i < toolCalls.length - 1) {
      elements.push({ tag: "hr" });
    }
  }

  // "Still working" indicator
  if (toolCalls.length > 0) {
    elements.push({ tag: "hr" });
  }
  elements.push({
    tag: "div",
    text: { content: "⏳ Processing next step...", tag: "lark_md" },
  });

  // Footer
  const footerParts: string[] = [];
  if (workspace) footerParts.push(`Workspace: ${workspace}`);
  footerParts.push(`Step ${currentStep}/${maxSteps}`);

  elements.push({ tag: "hr" });
  elements.push({
    tag: "note",
    elements: [{ tag: "lark_md", content: footerParts.join(" | ") }],
  });

  return {
    config: { wide_screen_mode: true },
    header: {
      title: {
        content: `🤖 Agent Working (${currentStep}/${maxSteps} steps)`,
        tag: "plain_text",
      },
      template: "blue",
    },
    elements,
  };
}

/**
 * Build the final result card after agent execution completes.
 */
export function buildFinalCard(options: {
  toolCalls: ToolCallEvent[];
  finalText: string;
  workspace?: string;
  durationMs: number;
}): Record<string, unknown> {
  const { toolCalls, finalText, workspace, durationMs } = options;

  const elements: Record<string, unknown>[] = [];

  // Tool calls summary (collapsed if many)
  const summaryLines = toolCalls.map((tc) => {
    const icon =
      tc.state === "error" ? "❌" : tc.state === "completed" ? "✅" : "⏳";
    return `${icon} **${tc.toolName}**`;
  });

  if (toolCalls.length > 0) {

    // Show first few tool calls in detail, collapse the rest
    const detailedCount = Math.min(toolCalls.length, 5);
    for (let i = 0; i < detailedCount; i++) {
      elements.push({
        tag: "div",
        text: { content: formatToolCallMd(toolCalls[i]), tag: "lark_md" },
      });
      elements.push({ tag: "hr" });
    }

    if (toolCalls.length > 5) {
      const remaining = summaryLines.slice(5).join(" | ");
      elements.push({
        tag: "div",
        text: {
          content: `... and ${toolCalls.length - 5} more: ${remaining}`,
          tag: "lark_md",
        },
      });
      elements.push({ tag: "hr" });
    }
  }

  // Final response text
  let displayText = finalText;
  if (displayText.length > MAX_FINAL_TEXT_CHARS) {
    displayText = displayText.slice(0, MAX_FINAL_TEXT_CHARS) + "\n\n... (truncated)";
  }

  elements.push({
    tag: "div",
    text: { content: displayText, tag: "lark_md" },
  });

  // Footer
  const durationSec = (durationMs / 1000).toFixed(1);
  const footerParts: string[] = [];
  if (workspace) footerParts.push(`Workspace: ${workspace}`);
  footerParts.push(`${toolCalls.length} tool calls`);
  footerParts.push(`${durationSec}s`);

  elements.push({ tag: "hr" });
  elements.push({
    tag: "note",
    elements: [{ tag: "lark_md", content: footerParts.join(" | ") }],
  });

  let card: Record<string, unknown> = {
    config: { wide_screen_mode: true },
    header: {
      title: { content: "🤖 Agent Complete", tag: "plain_text" },
      template: "green",
    },
    elements,
  };

  // Check card size and truncate if needed
  if (cardJsonSize(card) > MAX_CARD_BYTES) {
    // Remove detailed tool calls, keep only summary
    const trimmedElements: Record<string, unknown>[] = [];
    if (toolCalls.length > 0) {
      const allSummary = summaryLines.join(" | ");
      trimmedElements.push({
        tag: "div",
        text: {
          content: `${toolCalls.length} tool calls: ${allSummary}`,
          tag: "lark_md",
        },
      });
      trimmedElements.push({ tag: "hr" });
    }

    // Further truncate text if needed
    const FALLBACK_MAX_CHARS = 1500;
    const shorterText =
      finalText.length > FALLBACK_MAX_CHARS
        ? finalText.slice(0, FALLBACK_MAX_CHARS) + "\n\n... (truncated)"
        : finalText;
    trimmedElements.push({
      tag: "div",
      text: { content: shorterText, tag: "lark_md" },
    });

    trimmedElements.push({ tag: "hr" });
    trimmedElements.push({
      tag: "note",
      elements: [{ tag: "lark_md", content: footerParts.join(" | ") }],
    });

    card = { ...card, elements: trimmedElements };
  }

  return card;
}

/**
 * Build an error card.
 */
export function buildErrorCard(errorMessage: string): Record<string, unknown> {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { content: "🤖 Agent Error", tag: "plain_text" },
      template: "red",
    },
    elements: [
      {
        tag: "div",
        text: {
          content: `❌ ${errorMessage.slice(0, 2000)}`,
          tag: "lark_md",
        },
      },
    ],
  };
}

/**
 * Build a card for command responses (e.g. /workspace, /status).
 */
export function buildCommandResponseCard(
  command: string,
  response: string,
  status: "success" | "error"
): Record<string, unknown> {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: {
        content: status === "success" ? `✅ ${command}` : `❌ ${command}`,
        tag: "plain_text",
      },
      template: status === "success" ? "green" : "red",
    },
    elements: [
      {
        tag: "div",
        text: { content: response, tag: "lark_md" },
      },
    ],
  };
}
