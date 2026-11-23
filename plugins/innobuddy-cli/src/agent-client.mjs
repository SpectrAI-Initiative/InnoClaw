import { parseJsonEventStream } from "@ai-sdk/provider-utils";
import { readUIMessageStream, uiMessageChunkSchema } from "ai";

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function upsertMessage(messages, nextMessage) {
  const index = messages.findIndex((message) => message.id === nextMessage.id);
  if (index >= 0) {
    messages[index] = nextMessage;
  } else {
    messages.push(nextMessage);
  }
}

export function makeUserMessage(text) {
  return {
    id: randomId("user"),
    role: "user",
    parts: [{ type: "text", text }],
  };
}

export function getToolName(part) {
  if (part.toolName) {
    return part.toolName;
  }
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return part.type.slice(5);
  }
  return "unknown";
}

export function summarizeToolInput(toolName, input) {
  const args = input && typeof input === "object" ? input : {};
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
      return String(args.pattern || "");
    case "getSkillInstructions":
      return String(args.slug || "");
    default:
      try {
        return JSON.stringify(args);
      } catch {
        return "";
      }
  }
}

export function getMessageText(message) {
  return (message.parts || [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export async function runAgentStream(apiClient, {
  messages,
  workspaceId,
  cwd,
  mode = "agent",
  skillId,
  paramValues,
  llmProvider,
  llmModel,
  sessionCreatedAt,
  timeoutMs = 2 * 60 * 60 * 1000,
  onHeaders,
  onSnapshot,
} = {}) {
  const payload = {
    messages,
    workspaceId,
    cwd,
    mode,
    sessionCreatedAt,
  };

  if (skillId) {
    payload.skillId = skillId;
  }
  if (paramValues && Object.keys(paramValues).length > 0) {
    payload.paramValues = paramValues;
  }
  if (llmProvider && llmModel) {
    payload.llmProvider = llmProvider;
    payload.llmModel = llmModel;
  }

  const response = await apiClient.request("/api/agent", {
    method: "POST",
    body: payload,
    timeoutMs,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `${response.status} ${response.statusText}`);
  }

  onHeaders?.({
    provider: response.headers.get("X-Agent-Provider"),
    model: response.headers.get("X-Agent-Model"),
  });

  if (!response.body) {
    return {
      messages: [...messages],
      provider: response.headers.get("X-Agent-Provider"),
      model: response.headers.get("X-Agent-Model"),
    };
  }

  const nextMessages = [...messages];
  const chunkStream = parseJsonEventStream({
    stream: response.body,
    schema: uiMessageChunkSchema,
  }).pipeThrough(new TransformStream({
    transform(chunk, controller) {
      if (chunk.success) {
        controller.enqueue(chunk.value);
      }
    },
  }));

  const messageStream = readUIMessageStream({ stream: chunkStream });
  for await (const message of messageStream) {
    upsertMessage(nextMessages, message);
    onSnapshot?.(message, nextMessages);
  }

  return {
    messages: nextMessages,
    provider: response.headers.get("X-Agent-Provider"),
    model: response.headers.get("X-Agent-Model"),
  };
}
