import type { DeepResearchMessage, DeepResearchNode, ModelRole } from "./types";

export type NodeTranscriptKind = "input" | "status" | "output" | "error";

export const NODE_DETAIL_ONLY_DISPLAY = "node_detail_only";
const MAX_TRANSCRIPT_CHARS = 12000;

type NodeTranscriptMetadata = {
  display: typeof NODE_DETAIL_ONLY_DISPLAY;
  transcriptKind: NodeTranscriptKind;
  actorRole: ModelRole;
  nodeType: DeepResearchNode["nodeType"];
  synthetic?: boolean;
};

function truncateText(text: string, maxChars = MAX_TRANSCRIPT_CHARS): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n…truncated`;
}

export function serializeTranscriptPayload(payload: unknown): string {
  if (payload == null) {
    return "null";
  }

  if (typeof payload === "string") {
    return truncateText(payload);
  }

  try {
    return truncateText(JSON.stringify(payload, null, 2));
  } catch {
    return truncateText(String(payload));
  }
}

export function buildNodeTranscriptMetadata(
  node: DeepResearchNode,
  transcriptKind: NodeTranscriptKind,
  extras?: Partial<NodeTranscriptMetadata> & Record<string, unknown>,
): Record<string, unknown> {
  return {
    display: NODE_DETAIL_ONLY_DISPLAY,
    transcriptKind,
    actorRole: node.assignedRole,
    nodeType: node.nodeType,
    ...extras,
  };
}

export function isNodeDetailOnlyMessage(message: DeepResearchMessage): boolean {
  return message.metadata?.display === NODE_DETAIL_ONLY_DISPLAY;
}

export function getNodeTranscriptKind(message: DeepResearchMessage): NodeTranscriptKind | null {
  const kind = message.metadata?.transcriptKind;
  if (kind === "input" || kind === "status" || kind === "output" || kind === "error") {
    return kind;
  }
  return null;
}

export function hasNodeTranscriptKind(
  messages: DeepResearchMessage[],
  transcriptKind: NodeTranscriptKind,
): boolean {
  return messages.some((message) => getNodeTranscriptKind(message) === transcriptKind);
}
