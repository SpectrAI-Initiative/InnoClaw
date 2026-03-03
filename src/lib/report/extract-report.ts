import type { UIMessage } from "ai";
import type {
  ReportData,
  ReportProcessStep,
  ReportSource,
  ReportStatus,
} from "@/types/report";

const TOOL_LABEL_MAP: Record<string, string> = {
  bash: "Ran command",
  readFile: "Read file",
  writeFile: "Wrote file",
  listDirectory: "Listed directory",
  grep: "Searched files",
  kubectl: "Ran kubectl",
  submitK8sJob: "Submitted job",
};

function getToolLabel(toolName: string, args: Record<string, unknown>): string {
  const prefix = TOOL_LABEL_MAP[toolName] || toolName;
  const filePath = args.filePath ?? args.path;
  const dirPath = args.dirPath ?? args.path;

  if (toolName === "bash" && args.command) {
    const cmd = String(args.command);
    return `${prefix}: ${cmd.length > 80 ? cmd.slice(0, 80) + "..." : cmd}`;
  }
  if ((toolName === "readFile" || toolName === "writeFile") && filePath) {
    return `${prefix}: ${filePath}`;
  }
  if (toolName === "listDirectory" && dirPath) {
    return `${prefix}: ${dirPath}`;
  }
  if (toolName === "grep" && args.pattern) {
    return `${prefix}: "${args.pattern}"`;
  }
  return prefix;
}

export function extractReportContent(messages: UIMessage[]): string {
  // Find the longest text part from assistant messages that looks like a report
  let bestContent = "";
  let bestScore = 0;

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts ?? []) {
      if (part.type !== "text") continue;
      const text = part.text;
      const hasHeadings = /^#{1,3}\s+/m.test(text);
      const length = text.length;
      const score = length + (hasHeadings ? 10000 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestContent = text;
      }
    }
  }

  // Fallback: concatenate all assistant text parts
  if (!bestContent) {
    const parts: string[] = [];
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts ?? []) {
        if (part.type === "text" && part.text.trim()) {
          parts.push(part.text);
        }
      }
    }
    bestContent = parts.join("\n\n");
  }

  return bestContent;
}

export function extractProcessSteps(messages: UIMessage[]): ReportProcessStep[] {
  const steps: ReportProcessStep[] = [];
  let order = 0;

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const partType = (part as any).type as string | undefined;
      if (
        partType === "tool-invocation" ||
        partType === "dynamic-tool" ||
        partType?.startsWith?.("tool-")
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolPart = part as any;
        const toolName =
          toolPart.toolInvocation?.toolName ??
          toolPart.toolName ??
          (partType?.startsWith?.("tool-") ? partType.slice("tool-".length) : undefined) ??
          "unknown";
        const args = toolPart.toolInvocation?.args ?? toolPart.input ?? toolPart.args ?? {};
        const state = toolPart.toolInvocation?.state ?? toolPart.state ?? "output-available";

        let status: ReportProcessStep["status"] = "completed";
        if (state === "call" || state === "partial-call") {
          status = "running";
        } else if (state === "output-error") {
          status = "error";
        }

        steps.push({
          id: `step-${order}`,
          order,
          label: getToolLabel(toolName, args),
          toolName,
          status,
          detail: toolName === "bash" ? String(args.command ?? "") : undefined,
        });
        order++;
      }
    }
  }

  return steps;
}

export function extractSources(markdown: string): ReportSource[] {
  const sources: ReportSource[] = [];
  const seen = new Set<string>();

  // Parse [Source N: "filename"] citations
  const citationRegex = /\[Source\s+(\d+)(?::\s*"((?:[^"\\]|\\.)*)")?\]/g;
  let match;
  while ((match = citationRegex.exec(markdown)) !== null) {
    const num = match[1];
    const fileName = match[2]?.replace(/\\(["\\])/g, "$1");
    const key = `source-${num}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({
        id: key,
        title: fileName || `Source ${num}`,
        fileName: fileName || undefined,
        snippet: "",
      });
    }
  }

  // Parse markdown links [text](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  while ((match = linkRegex.exec(markdown)) !== null) {
    const title = match[1];
    const url = match[2];
    const key = `link-${url}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({
        id: key,
        title,
        url,
        snippet: "",
      });
    }
  }

  return sources;
}

export function extractReportTitle(markdown: string): string {
  // Try to find first heading
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();

  // Fallback: first non-empty line
  const firstLine = markdown.split("\n").find((l) => l.trim().length > 0);
  return firstLine?.slice(0, 100) || "Research Report";
}

export function buildReportData(
  workspaceId: string,
  messages: UIMessage[]
): ReportData | null {
  if (!messages || messages.length === 0) return null;

  const markdownContent = extractReportContent(messages);
  if (!markdownContent.trim()) return null;

  const processSteps = extractProcessSteps(messages);
  const sources = extractSources(markdownContent);
  const title = extractReportTitle(markdownContent);

  const hasRunningSteps = processSteps.some((s) => s.status === "running");
  const hasError = processSteps.some((s) => s.status === "error");
  let status: ReportStatus = "completed";
  if (hasRunningSteps) status = "running";
  else if (hasError) status = "error";

  const now = new Date().toISOString();

  return {
    id: `report-${workspaceId}`,
    workspaceId,
    title,
    status,
    markdownContent,
    sources,
    processSteps,
    createdAt: now,
    updatedAt: now,
  };
}
