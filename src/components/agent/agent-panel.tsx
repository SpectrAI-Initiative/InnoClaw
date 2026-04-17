"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { FileUIPart, UIMessage } from "ai";
import { agentStreamManager } from "@/lib/agent/agent-stream-manager";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ImagePlus,
  Loader2,
  Square,
  Brain,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useSkills } from "@/lib/hooks/use-skills";
import { getOverflowThresholdChars, getMessageTextLength, getContextWindowChars, modelSupportsVision, PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL, DEFAULT_CONTEXT_MODE } from "@/lib/ai/models";
import type { ProviderId } from "@/lib/ai/models";
import { SkillAutocomplete } from "@/components/skills/skill-autocomplete";
import { SkillParameterDialog } from "@/components/skills/skill-parameter-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ParticleEffect, ThinkingIndicator, FloatingOrbs } from "@/components/ui/particle-effect";
import type { Skill } from "@/types";
import { swrFetcher as fetcher } from "@/lib/fetcher";
import { useModelSelection } from "@/lib/hooks/use-model-selection";
import { useCostTracking } from "@/lib/hooks/use-cost-tracking";
import { AgentMessage } from "./agent-message";
import { CostDisplay } from "./cost-display";
import { MemoryPanel } from "./memory-panel";
import { BuddyAvatar } from "./buddy-avatar";
import { BuddyHatchDialog } from "./buddy-hatch-dialog";
import { WorkspaceImagePickerDialog } from "./workspace-image-picker-dialog";
import { toast } from "sonner";
import {
  createImageFileParts,
  extractImageFilesFromClipboard,
  stripFilePartsForStorage,
} from "@/lib/ai/message-attachments";
import { ImageAttachmentGrid } from "@/components/ui/image-attachment-grid";
import {
  BUILTIN_COMMANDS,
  getMatchingSkillsForSlashQuery,
  shouldAutocompleteCaptureEnter,
  type BuiltinCommand,
} from "./slash-command";
import { extractMemoryTags } from "@/lib/agent/kairos-memory";
import {
  buildOverflowCompactionPlan,
  excludeKeptMessages,
  getRenderableMessages,
  requestConversationSummaryPreview,
  saveConversationMemoryNote,
} from "@/lib/agent/conversation-compaction";
import { getMessageText } from "./message-utils";
import { useDraggableDialog, ResizeHandles } from "./use-draggable-dialog";
import { getWorkspaceImageMimeType } from "./workspace-image-picker-utils";
import { focusAgentInputAfterDialogClose } from "./workspace-image-picker-utils";
import {
  ConversationMemoryPreviewDialog,
  ConversationMessageSelectionDialog,
} from "@/components/conversation/conversation-compaction-dialogs";

type AgentMode = "long-agent" | "agent" | "plan" | "ask";
type ModelSelection = { provider: string; model: string };

/** Pixel threshold for considering the user "at the bottom" of the scroll area */
const BOTTOM_THRESHOLD_PX = 80;

/** XML tag used to wrap compacted context summaries in messages. */
const CONTEXT_SUMMARY_OPEN = "<context_summary>";
const CONTEXT_SUMMARY_CLOSE = "</context_summary>";

/** Build a UIMessage containing a compacted context summary. */
function makeContextSummaryMessage(content: string, notice: string): UIMessage {
  return {
    id: `memory-${Date.now()}`,
    role: "user",
    parts: [{
      type: "text",
      text: `${CONTEXT_SUMMARY_OPEN}\n${content}\n${CONTEXT_SUMMARY_CLOSE}\n${notice}`,
    }],
  } as UIMessage;
}

const MODE_LABEL_KEYS: Record<AgentMode, "modeLongAgent" | "modeAgent" | "modePlan" | "modeAsk"> = {
  "long-agent": "modeLongAgent",
  agent: "modeAgent",
  plan: "modePlan",
  ask: "modeAsk",
};

const MODE_PLACEHOLDER_KEYS: Record<AgentMode, "placeholder" | "placeholderLongAgent" | "placeholderPlan" | "placeholderAsk"> = {
  "long-agent": "placeholderLongAgent",
  agent: "placeholder",
  plan: "placeholderPlan",
  ask: "placeholderAsk",
};

// --- Main Panel ---

interface AgentPanelProps {
  workspaceId: string;
  workspaceName: string;
  folderPath: string;
  sessionId: string;
  sessionName?: string;
  sessionCreatedAt?: string;
  onLoadingChange?: (loading: boolean) => void;
}

export function AgentPanel({
  workspaceId,
  folderPath,
  sessionId,
  sessionName,
  sessionCreatedAt,
  onLoadingChange,
}: AgentPanelProps) {
  const t = useTranslations("agent");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<FileUIPart[]>([]);
  const [mode, setMode] = useState<AgentMode>("agent");

  // Draggable input area height
  const [inputHeight, setInputHeight] = useState(80);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: inputHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const containerH = containerRef.current.getBoundingClientRect().height;
      const maxH = containerH * 0.7;
      const delta = dragRef.current.startY - ev.clientY;
      const newH = Math.max(60, Math.min(maxH, dragRef.current.startH + delta));
      setInputHeight(newH);
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [inputHeight]);

  // Skills state
  const { skills: availableSkills } = useSkills(workspaceId);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [showParamDialog, setShowParamDialog] = useState(false);
  const [showWorkspaceImagePicker, setShowWorkspaceImagePicker] = useState(false);

  // Auto-memory state
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summarizingRef = useRef(false);
  const failedAtCountRef = useRef(-1);

  // Memory panel state
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [showCostDisplay, setShowCostDisplay] = useState(true);

  // Buddy companion state
  const [showBuddyHatch, setShowBuddyHatch] = useState(false);
  const [buddyKey, setBuddyKey] = useState(0);

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

  // Shared draggable + resizable dialog (message-select and memory-preview are mutually exclusive)
  const { dialogStyle, onDragStart, onEdgeResizeStart } = useDraggableDialog({
    open: showMessageSelect || showMemoryPreview,
  });

  const { data: settings } = useSWR("/api/settings", fetcher);
  const aiEnabled = settings?.hasAIKey ?? false;

  const configuredProviderIds = useMemo(() => {
    const configured = settings?.configuredProviders as string[] | undefined;
    if (!configured) return [];
    return configured.filter((id): id is ProviderId => Boolean(PROVIDERS[id as ProviderId]));
  }, [settings?.configuredProviders]);

  const settingsFallback = useMemo<ModelSelection | null>(() => {
    if (!settings?.llmProvider || !settings?.llmModel) return null;
    if (
      configuredProviderIds.length > 0 &&
      !configuredProviderIds.includes(settings.llmProvider as ProviderId)
    ) {
      return null;
    }
    return { provider: settings.llmProvider as string, model: settings.llmModel as string };
  }, [configuredProviderIds, settings?.llmModel, settings?.llmProvider]);

  const {
    selectedProvider,
    selectedModel,
    modelDisplayName,
    resolvedSelection,
    availableProviders,
    selectedSupportsVision,
    handleModelChange,
    refreshDiscoveredModels,
  } = useModelSelection({
    storageKey: "innoclaw-agent-model-selection",
    configuredProviderIds,
    settingsFallback,
    fallbackDisplayName: t("modelLabel"),
  });

  // Mutable body object — allows injecting skillId/paramValues before each send
  const agentBody = useMemo(
    () =>
      ({ workspaceId, cwd: folderPath, mode: "agent", sessionCreatedAt }) as Record<string, unknown>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Keep body in sync with props
  useEffect(() => {
    agentBody.workspaceId = workspaceId;
    agentBody.cwd = folderPath;
    agentBody.sessionCreatedAt = sessionCreatedAt;
  }, [workspaceId, folderPath, sessionCreatedAt, agentBody]);

  // Stream key for the background stream manager (use refs so the memoized
  // transport always reads the latest values).
  // Note: do not include `mode` here so that changing modes mid-stream does
  // not change the key under which the active stream is registered.
  const streamKey = `${workspaceId}:${sessionId}`;
  const streamKeyRef = useRef(streamKey);
  const storageKeyForManagerRef = useRef(`agent-messages:${workspaceId}:${sessionId}`);
  useEffect(() => {
    streamKeyRef.current = streamKey;
    storageKeyForManagerRef.current = `agent-messages:${workspaceId}:${sessionId}`;
  }, [workspaceId, sessionId, streamKey]);

  // Create transport once with the mutable body reference.
  // Uses a custom fetch that tees the response body so the background manager
  // can keep reading even after this component unmounts.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: agentBody,
        fetch: async (
          input: string | URL | Request,
          init?: RequestInit,
        ): Promise<Response> => {
          // Use the component's abort signal for the network request itself
          const { signal: _componentSignal, ...restInit } = init ?? {};

          const response = await globalThis.fetch(input, {
            ...restInit,
            signal: _componentSignal,
          });

          // If the response is not OK or has no body, do not register with the manager
          if (!response.ok || !response.body) {
            return response;
          }

          // Only register with the agent stream manager once we know we have a streaming body
          agentStreamManager.register(
            streamKeyRef.current,
            storageKeyForManagerRef.current,
          );
          // Tee the response body — component gets one branch, manager gets the other
          const [managerBranch, componentBranch] = response.body.tee();

          // Manager reads its branch in the background (fire-and-forget)
          agentStreamManager.consumeInBackground(streamKeyRef.current, managerBranch);

          // Return a Response with the component branch for DefaultChatTransport
          return new Response(componentBranch, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        },
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
  const storageKey = `agent-messages:${workspaceId}:${sessionId}`;
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
        localStorage.setItem(
          storageKey,
          JSON.stringify(stripFilePartsForStorage(messages)),
        );
      }
      // Notify same-tab listeners (StorageEvent only fires cross-tab)
      window.dispatchEvent(new CustomEvent("agent-messages-updated", { detail: { key: storageKey } }));
    } catch {
      // storage full or unavailable — silently ignore
    }
  }, [messages, storageKey, status]);

  // Force-save messages to localStorage on unmount, even during streaming.
  // This ensures the latest state is persisted when navigating away.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    return () => {
      // On unmount, persist the current messages regardless of streaming state.
      // If the background stream manager is still active, save raw messages
      // (do NOT scrub tool parts — the agent is still working in the background).
      const msgs = messagesRef.current;
      if (msgs.length > 0) {
        try {
          const bgActive = agentStreamManager.isActive(streamKeyRef.current);
          const toSave = bgActive ? msgs : scrubStuckToolParts(msgs);
          localStorage.setItem(
            storageKey,
            JSON.stringify(stripFilePartsForStorage(toSave)),
          );
        } catch { /* ignore */ }
      }
    };
  }, [storageKey]);

  // On mount: if the background stream manager is still active, subscribe
  // to its updates so messages appear in real-time.  When the stream
  // finishes, do a final read and scrub any stuck tool parts.
  useEffect(() => {
    if (!agentStreamManager.isActive(streamKey)) return;

    const readFromStorage = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as UIMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            restoreGenRef.current++;
            setMessages(parsed);
          }
        }
      } catch { /* ignore */ }
    };

    // Read immediately on mount to pick up what accumulated while away
    readFromStorage();

    // Subscribe to manager updates (fires whenever the manager persists)
    const unsub = agentStreamManager.subscribe(
      streamKey,
      // onUpdate: read latest messages from localStorage
      readFromStorage,
      // onDone: final read + scrub any stuck tool parts
      () => {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const parsed = JSON.parse(saved) as UIMessage[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              restoreGenRef.current++;
              setMessages(scrubStuckToolParts(parsed));
            }
          }
        } catch { /* ignore */ }
        agentStreamManager.cleanup(streamKey);
      },
    );

    return unsub;
  }, [streamKey, storageKey, setMessages]);

  // --- Auto-continue: automatically continue when task is incomplete ---
  const prevStatusRef = useRef(status);
  const autoContinueCountRef = useRef(0);
  const autoContinueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxAutoContinues = mode === "long-agent" ? 100 : 20; // long-agent supports extended interactions

  // --- Auto-retry on stream errors ---
  const errorRetryCountRef = useRef(0);
  const MAX_ERROR_RETRIES = 3;

  useEffect(() => {
    const wasActive = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    const isNowReady = status === "ready";
    const isNowError = status === "error";
    prevStatusRef.current = status;

    // Reset counters when user sends a new message
    if (status === "submitted") {
      autoContinueCountRef.current = 0;
      return;
    }

    // Reset error retries on successful completion
    if (wasActive && isNowReady) {
      errorRetryCountRef.current = 0;
    }

    // --- Auto-retry on error (exponential backoff: 2s, 4s, 8s) ---
    if (wasActive && isNowError && errorRetryCountRef.current < MAX_ERROR_RETRIES) {
      // Don't retry context-length errors — retrying with the same context won't help
      const errMsg = chatError?.message?.toLowerCase() ?? "";
      if (errMsg.includes("context") || errMsg.includes("token") || errMsg.includes("too long")
        || errMsg.includes("max_tokens") || errMsg.includes("context_length") || errMsg.includes("rate_limit")) {
        return;
      }
      errorRetryCountRef.current++;
      const delay = Math.pow(2, errorRetryCountRef.current) * 1000;
      autoContinueTimerRef.current = setTimeout(() => {
        if (summarizingRef.current) return;
        sendMessage({ text: t("autoContinue") });
      }, delay);
      return () => {
        if (autoContinueTimerRef.current) {
          clearTimeout(autoContinueTimerRef.current);
          autoContinueTimerRef.current = null;
        }
      };
    }

    // Only trigger auto-continue on transition from streaming to ready
    if (!wasActive || !isNowReady) {
      return;
    }

    // Check if we've hit the auto-continue limit
    if (autoContinueCountRef.current >= maxAutoContinues) {
      return;
    }

    // Check if the last assistant message ends with a tool call (task incomplete)
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    const parts = lastMessage.parts || [];
    const lastPart = parts.length > 0 ? parts[parts.length - 1] : undefined;
    const endsWithToolCall = lastPart != null && (
      lastPart.type?.startsWith("tool-") || lastPart.type === "dynamic-tool"
    );

    // Only auto-continue when the last assistant message ends with a tool call,
    // indicating the task is incomplete. Pure-text endings are treated as
    // completed — the model is done talking.
    if (!endsWithToolCall) {
      return;
    }

    autoContinueCountRef.current++;
    autoContinueTimerRef.current = setTimeout(() => {
      if (summarizingRef.current) return;
      sendMessage({ text: t("autoContinue") });
    }, 500);
    return () => {
      if (autoContinueTimerRef.current) {
        clearTimeout(autoContinueTimerRef.current);
        autoContinueTimerRef.current = null;
      }
    };
  }, [status, messages, sendMessage, t, maxAutoContinues, chatError]);

  // Resolved provider/model (avoids repeating fallback chain)
  const resolvedProvider = selectedProvider ?? settings?.llmProvider ?? DEFAULT_PROVIDER;
  const resolvedModel = selectedModel ?? settings?.llmModel ?? DEFAULT_MODEL;
  const resolvedProviderName = useMemo(
    () => PROVIDERS[resolvedProvider as ProviderId]?.name ?? resolvedProvider,
    [resolvedProvider]
  );
  const resolvedModelDisplayName = useMemo(() => {
    const provider = PROVIDERS[resolvedProvider as ProviderId];
    const model = provider?.models.find((m) => m.id === resolvedModel);
    return model?.name ?? resolvedModel;
  }, [resolvedProvider, resolvedModel]);
  const supportsVision = useMemo(
    () => modelSupportsVision(resolvedProvider, resolvedModel),
    [resolvedProvider, resolvedModel],
  );

  const overflowThreshold = getOverflowThresholdChars(
    resolvedProvider,
    resolvedModel,
    settings?.contextMode ?? DEFAULT_CONTEXT_MODE
  );

  // Compute context usage percentage for display
  const contextWindowChars = useMemo(
    () => getContextWindowChars(resolvedProvider, resolvedModel),
    [resolvedProvider, resolvedModel]
  );
  const totalMessageChars = useMemo(
    () => messages.reduce((sum, m) => sum + getMessageTextLength(m), 0),
    [messages]
  );
  const contextPercent = useMemo(
    () => Math.min(Math.round((totalMessageChars / contextWindowChars) * 100), 100),
    [totalMessageChars, contextWindowChars]
  );

  const { costSnapshot } = useCostTracking({
    storageKey: `agent-cost:${workspaceId}:${sessionId}`,
    messages,
    status,
    resolvedModel,
  });

  // Extract <memory> tags from assistant messages and save to daily log
  const lastMemoryExtractRef = useRef(0);
  useEffect(() => {
    if (status !== "ready") return;
    if (messages.length <= lastMemoryExtractRef.current) {
      lastMemoryExtractRef.current = messages.length;
      return;
    }
    const newMessages = messages.slice(lastMemoryExtractRef.current);
    lastMemoryExtractRef.current = messages.length;

    for (const msg of newMessages) {
      if (msg.role !== "assistant") continue;
      const text = getMessageText(msg);
      const memories = extractMemoryTags(text);
      for (const mem of memories) {
        fetch("/api/agent/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, action: "remember", text: mem }),
        }).catch(() => { /* best-effort */ });
      }
    }
  }, [messages, status, workspaceId]);

  // Last assistant message text for buddy reactions
  const lastAssistantMessage = useMemo(() => {
    if (status === "streaming" || status === "submitted") return undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return getMessageText(messages[i]) || undefined;
      }
    }
    return undefined;
  }, [messages, status]);

  const summarizeAndEvict = async (
    messagesToSummarize: UIMessage[],
    messagesToKeep: UIMessage[],
    trigger: "overflow" | "clear"
  ) => {
    if (summarizingRef.current) return;
    // Cancel any pending auto-continue to prevent race with summarization
    if (autoContinueTimerRef.current) {
      clearTimeout(autoContinueTimerRef.current);
      autoContinueTimerRef.current = null;
    }
    summarizingRef.current = true;
    failedAtCountRef.current = -1;
    setIsSummarizing(true);
    setSummaryError(null);

    try {
      // Step 1: Generate compact summary (preview mode — don't save yet)
      const res = await fetch("/api/agent/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          messages: messagesToSummarize,
          trigger,
          preview: true,
          compact: true,
          locale,
          sessionName,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Summarization failed" }));
        throw new Error(errData.error || "Summarization failed");
      }

      const { title, content } = await res.json();

      // Step 2: Save to DB as memory note (best-effort — don't block context compaction on save failure)
      const saveRes = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title,
          content,
          type: "memory",
        }),
      });
      if (!saveRes.ok) {
        console.warn("Failed to save memory note to DB:", await saveRes.text().catch(() => ""));
      }

      // Step 3: Inject compact summary or clear
      if (trigger === "clear") {
        setMessages([]);
      } else {
        // Inject the compact summary as a user-role context message
        const contextSummary = makeContextSummaryMessage(content, t("contextCompactedNotice"));
        setMessages([contextSummary, ...messagesToKeep]);
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
    if (settings?.maxMode === false && mode !== "long-agent") return;
    if (restoreGenRef.current > 0 || isSummarizing) return;
    if (showMessageSelect || showMemoryPreview) return; // Don't trigger while dialog is open
    if (status !== "ready" && status !== "error") return;
    const plan = buildOverflowCompactionPlan({
      messages,
      overflowThreshold,
      failedAtCount: failedAtCountRef.current,
    });
    if (!plan) return;
    const { toSummarize, toKeep } = plan;

    // In long-agent mode, auto-summarize without user interaction to keep the pipeline flowing
    if (mode === "long-agent") {
      summarizeAndEvict(toSummarize, toKeep, "overflow");
      return;
    }

    // Show message selection dialog instead of auto-summarizing
    overflowKeepRef.current = toKeep;
    // Only pre-select messages with renderable text content
    setSelectedMessageIds(new Set(getRenderableMessages(toSummarize).map((message) => message.id)));
    setShowMessageSelect(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, isSummarizing, showMessageSelect, showMemoryPreview]);

  const isLoading = status === "submitted" || status === "streaming" || agentStreamManager.isActive(streamKey);

  // Notify parent of loading state changes (use ref to avoid effect re-triggering)
  const onLoadingChangeRef = useRef(onLoadingChange);
  onLoadingChangeRef.current = onLoadingChange;
  useEffect(() => {
    onLoadingChangeRef.current?.(isLoading);
  }, [isLoading]);

  // Cached viewport element to avoid repeated DOM queries
  const viewportRef = useRef<Element | null>(null);
  const getViewport = useCallback(() => {
    if (!viewportRef.current) {
      viewportRef.current = scrollRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) ?? null;
    }
    return viewportRef.current;
  }, []);

  // Track whether user has scrolled away from the bottom
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;
    let rafId = 0;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < BOTTOM_THRESHOLD_PX;
        userScrolledUp.current = !atBottom;
      });
    };
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [getViewport]);

  // Auto-scroll to bottom when messages update (skip if user scrolled up)
  useEffect(() => {
    if (userScrolledUp.current) return;
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, status, getViewport]);

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

  const handleBuiltinCommand = (command: BuiltinCommand, args?: string) => {
    setShowAutocomplete(false);
    setInput("");
    switch (command.slug) {
      case "compact":
        if (messages.length >= 4) {
          const keepCount = Math.max(2, Math.floor(messages.length * 0.3));
          const toSummarize = messages.slice(0, messages.length - keepCount);
          const toKeep = messages.slice(messages.length - keepCount);
          summarizeAndEvict(toSummarize, toKeep, "overflow");
        } else {
          toast.info("Not enough messages to compact");
        }
        break;
      case "cost":
        setShowCostDisplay((prev) => !prev);
        break;
      case "memory":
        setShowMemoryPanel(true);
        break;
      case "remember":
        if (args) {
          fetch("/api/agent/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspaceId, action: "remember", text: args }),
          }).then((res) => {
            if (res.ok) toast.success("Memory saved");
            else toast.error("Failed to save memory");
          }).catch(() => toast.error("Failed to save memory"));
        } else {
          setInput("/remember ");
        }
        break;
      case "dream":
        toast.info("Starting dream consolidation...");
        fetch("/api/agent/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, action: "dream" }),
        }).then((res) => {
          if (res.ok) toast.success("Dream consolidation complete");
          else toast.error("Dream consolidation failed");
        }).catch(() => toast.error("Dream consolidation failed"));
        break;
    }
  };

  // Execute skill after params are collected
  const executeSkill = async (
    skill: Skill,
    paramValues: Record<string, string>
  ) => {
    if (pendingImages.length > 0 && !supportsVision) {
      setActiveSkill(null);
      toast.error(t("imageInputUnsupported"));
      return;
    }

    const files = pendingImages;
    const skillText = `/${skill.slug}${Object.keys(paramValues).length > 0 ? " " + Object.entries(paramValues).map(([k, v]) => `${k}="${v}"`).join(" ") : ""}`;
    setInput("");
    setPendingImages([]);
    setActiveSkill(null);

    // Inject skill context into the mutable body before sending
    agentBody.skillId = skill.id;
    agentBody.paramValues = paramValues;
    agentBody.mode = mode;
    agentBody.llmProvider = selectedProvider;
    agentBody.llmModel = selectedModel;

    try {
      if (files.length > 0) {
        await sendMessage({ text: skillText, files });
      } else {
        await sendMessage({ text: skillText });
      }
    } catch {
      setInput(skillText);
      setPendingImages(files);
    } finally {
      // Clear skill context after sending, even if sendMessage throws
      delete agentBody.skillId;
      delete agentBody.paramValues;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || isLoading || !aiEnabled || isSummarizing) return;
    if (pendingImages.length > 0 && !supportsVision) {
      toast.error(t("imageInputUnsupported"));
      return;
    }
    userScrolledUp.current = false;

    // Handle built-in slash commands before skill matching
    if (text.startsWith("/")) {
      const parts = text.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");
      const builtinMatch = BUILTIN_COMMANDS.find((c) => c.slug === cmd);
      if (builtinMatch) {
        handleBuiltinCommand(builtinMatch, args);
        return;
      }
    }

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

    const files = pendingImages;
    setInput("");
    setPendingImages([]);
    setShowAutocomplete(false);
    agentBody.mode = mode; // ensure mode is current before every request
    agentBody.llmProvider = selectedProvider;
    agentBody.llmModel = selectedModel;
    try {
      if (text && files.length > 0) {
        await sendMessage({ text, files });
      } else if (text) {
        await sendMessage({ text });
      } else {
        await sendMessage({ files });
      }
    } catch {
      setInput(text);
      setPendingImages(files);
    }
  };

  const handleInputPaste = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const imageFiles = extractImageFilesFromClipboard(event.clipboardData);
    if (imageFiles.length === 0) return;

    event.preventDefault();

    if (!supportsVision) {
      toast.error(t("imageInputUnsupported"));
      return;
    }

    try {
      const nextImages = await createImageFileParts(imageFiles);
      setPendingImages((current) => [...current, ...nextImages]);
    } catch {
      toast.error(t("imagePasteFailed"));
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const handleWorkspaceImageSelect = async (filePath: string) => {
    if (!supportsVision) {
      toast.error(t("imageInputUnsupported"));
      return;
    }

    try {
      const response = await fetch(`/api/files/raw?path=${encodeURIComponent(filePath)}`);
      if (!response.ok) {
        throw new Error("Failed to read workspace image");
      }

      const blob = await response.blob();
      const filename = filePath.split("/").pop() || "workspace-image";
      const file = new File([blob], filename, {
        type: getWorkspaceImageMimeType(filePath, blob.type),
      });
      const nextImages = await createImageFileParts([file]);

      if (nextImages.length === 0) {
        throw new Error("No image attachment created");
      }

      setPendingImages((current) => [...current, ...nextImages]);
      setShowWorkspaceImagePicker(false);
    } catch {
      toast.error(t("workspaceImageAttachFailed"));
    }
  };

  const handleStop = () => {
    stop();
    // Also stop the background stream manager
    agentStreamManager.stop(streamKey);
    // Scrub incomplete tool parts so the next sendMessage works cleanly
    // Use setTimeout to let useChat process the abort first
    setTimeout(() => {
      setMessages((prev) => scrubStuckToolParts(prev));
    }, 100);
  };

  // Messages that have renderable text content (used for selection UI)
  const selectableMessages = useMemo(
    () => getRenderableMessages(messages),
    [messages]
  );

  const handleClear = () => {
    if (status === "streaming" || status === "submitted") stop();
    agentStreamManager.stop(streamKey);
    if (messages.length > 0 && aiEnabled) {
      // Show message selection dialog first
      overflowKeepRef.current = null; // null = manual clear (not overflow)
      setSelectedMessageIds(new Set(selectableMessages.map((m) => m.id)));
      setShowMessageSelect(true);
    } else {
      setMessages([]);
    }
    setInput("");
    setPendingImages([]);
  };

  // Step 2: generate preview from selected messages
  const handleSelectNext = async () => {
    setShowMessageSelect(false);
    const selected = messages.filter((m) => selectedMessageIds.has(m.id));
    if (selected.length === 0) return;

    setIsSummarizing(true);
    setSummaryError(null);
    try {
      const data = await requestConversationSummaryPreview({
        workspaceId,
        messages: selected,
        trigger: overflowKeepRef.current ? "overflow" : "clear",
        compact: true,
        locale,
        sessionName,
      });
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
      const toSummarize = excludeKeptMessages(messages, toKeep);
      overflowKeepRef.current = null;
      summarizeAndEvict(toSummarize, toKeep, "overflow");
    }
  };

  const handleMemoryConfirm = async () => {
    setShowMemoryPreview(false);
    setIsSummarizing(true);
    try {
      await saveConversationMemoryNote({
        workspaceId,
        title: memoryPreviewTitle,
        content: memoryPreviewContent,
      });
      if (overflowKeepRef.current) {
        // Overflow: keep recent messages, inject compact summary as context
        const contextSummary = makeContextSummaryMessage(memoryPreviewContent, t("contextCompactedNotice"));
        setMessages([contextSummary, ...scrubStuckToolParts(overflowKeepRef.current)]);
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
      const toSummarize = excludeKeptMessages(messages, toKeep);
      overflowKeepRef.current = null;
      summarizeAndEvict(toSummarize, toKeep, "overflow");
    }
  };

  // Switch mode: update body synchronously, keep conversation context
  const handleModeChange = (newMode: AgentMode) => {
    setMode(newMode);
    agentBody.mode = newMode; // synchronous — guarantees next request uses correct mode
    setInput("");
  };

  const slashQuery = input.startsWith("/") ? input.slice(1) : "";
  const matchingSlashSkills = useMemo(
    () => getMatchingSkillsForSlashQuery(availableSkills, slashQuery),
    [availableSkills, slashQuery]
  );
  const autocompleteCapturesEnter = shouldAutocompleteCaptureEnter(
    showAutocomplete,
    matchingSlashSkills
  );

  return (
    <div ref={containerRef} className="relative flex h-full min-w-0 flex-col bg-agent-bg text-agent-foreground font-mono text-sm overflow-hidden">
      <div className="relative z-10 flex items-center justify-between gap-3 border-b border-agent-border/70 bg-agent-bg/90 px-3 py-2 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-4 w-4 shrink-0 text-agent-accent" />
          <span className="text-xs text-agent-muted shrink-0">Current model</span>
          <Badge variant="outline" className="max-w-[220px] truncate text-[10px]">
            {resolvedModelDisplayName}
          </Badge>
        </div>
        <Badge variant="secondary" className="max-w-[160px] truncate text-[10px] shrink-0">
          {resolvedProviderName}
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="relative z-10 flex-1 [&_[data-slot=scroll-area-viewport]]:!overflow-x-hidden [&_[data-slot=scroll-area-viewport]>div]:!block [&_[data-slot=scroll-area-viewport]>div]:!min-w-0 [&_[data-slot=scroll-area-scrollbar][data-orientation=horizontal]]:hidden" ref={scrollRef}>
        <div className="p-3 space-y-5 overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
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
            messages.map((message) => {
              // Filter out auto-continue messages (user messages with only "Continue" / "继续")
              if (message.role === "user") {
                const text = getMessageText(message).trim();
                if (text === "Continue" || text === "继续") return null;
              }
              return <AgentMessage key={message.id} message={message} />;
            })
          )}

          {/* Loading indicator with enhanced effects */}
          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <div className="relative my-4">
                <div className="relative flex items-center gap-3 rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 p-4 backdrop-blur-sm animate-glow-pulse overflow-hidden">
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/10 to-primary/5 animate-[gradient-rotate_3s_linear_infinite] bg-[length:200%_100%]" />
                  {/* Scanning line effect */}
                  <div className="absolute inset-x-0 top-0 h-full overflow-hidden">
                    <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-[scan-line_2s_linear_infinite]" />
                  </div>
                  {/* Glow orbs */}
                  <div className="absolute -left-4 -top-4 h-16 w-16 rounded-full bg-primary/20 blur-xl animate-pulse" />
                  <div className="absolute -right-4 -bottom-4 h-12 w-12 rounded-full bg-accent/20 blur-xl animate-pulse [animation-delay:0.5s]" />
                  <ThinkingIndicator label="InnoClaw thinking" />
                </div>
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

      {/* Draggable divider */}
      <div
        className="relative z-20 h-1.5 cursor-row-resize group shrink-0 flex items-center justify-center"
        onMouseDown={handleDragStart}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-agent-border" />
        <div className="h-0.5 w-8 rounded-full bg-muted-foreground/30 group-hover:bg-primary/50 transition-colors" />
      </div>

      {/* Input area with autocomplete */}
      <div className="relative z-10 flex shrink-0 flex-col overflow-hidden bg-agent-bg/80 backdrop-blur-sm" style={{ height: inputHeight }}>
        {/* Slash command autocomplete */}
        {autocompleteCapturesEnter && (
          <SkillAutocomplete
            query={slashQuery}
            skills={availableSkills}
            onSelect={handleSkillSelect}
            onBuiltinSelect={handleBuiltinCommand}
            onClose={() => setShowAutocomplete(false)}
          />
        )}

        <ImageAttachmentGrid
          attachments={pendingImages}
          onRemove={removePendingImage}
          className="px-3 pt-2"
          imageClassName="h-16 w-16"
          removeLabel={t("removeImage")}
        />

        <div className="flex min-h-0 flex-1 items-start gap-2 px-3 py-2">
          {/* Model selector */}
          <DropdownMenu
            onOpenChange={(open) => {
              if (open) {
                void refreshDiscoveredModels();
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 shrink-0 rounded px-1.5 py-0.5 text-xs text-agent-accent hover:bg-agent-card-hover transition-colors mt-1.5 max-w-[220px]">
                <span className="truncate">{modelDisplayName}</span>
                {resolvedSelection?.unmatchedKind && (
                  <Badge
                    variant="outline"
                    className="shrink-0 px-1 py-0 text-[10px] leading-4 border-slate-500/40 text-slate-300"
                  >
                    {resolvedSelection.unmatchedKind === "not-found"
                      ? tCommon("modelNotFound")
                      : tCommon("customModel")}
                  </Badge>
                )}
                {typeof selectedSupportsVision === "boolean" && (
                  <Badge
                    variant="outline"
                    className={`shrink-0 px-1 py-0 text-[10px] leading-4 ${
                      selectedSupportsVision
                        ? "border-emerald-500/40 text-emerald-300"
                        : "border-amber-500/40 text-amber-300"
                    }`}
                  >
                    {selectedSupportsVision ? tCommon("multimodal") : tCommon("textOnly")}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto">
              <DropdownMenuLabel className="text-xs">{t("modelLabel")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableProviders.map((provider) => (
                <React.Fragment key={provider.id}>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">{provider.name}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    key={provider.id}
                    value={selectedProvider === provider.id ? (selectedModel ?? "") : ""}
                    onValueChange={(modelId) => handleModelChange(provider.id, modelId)}
                  >
                    {provider.models.map((model: { id: string; name: string }) => (
                      <DropdownMenuRadioItem key={model.id} value={model.id}>
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{model.name}</span>
                          <Badge
                            variant="outline"
                            className={`shrink-0 px-1 py-0 text-[10px] leading-4 ${
                              modelSupportsVision(provider.id, model.id)
                                ? "border-emerald-500/40 text-emerald-300"
                                : "border-amber-500/40 text-amber-300"
                            }`}
                          >
                            {modelSupportsVision(provider.id, model.id) ? tCommon("multimodal") : tCommon("textOnly")}
                          </Badge>
                        </div>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mode selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-xs text-agent-accent hover:bg-agent-card-hover transition-colors mt-1.5">
                {t(MODE_LABEL_KEYS[mode])}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-xs">{t("modeLabel")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={mode} onValueChange={(v) => handleModeChange(v as AgentMode)}>
                <DropdownMenuRadioItem value="long-agent">
                  <div className="flex flex-col">
                    <span>{t("modeLongAgent")}</span>
                    <span className="text-xs text-muted-foreground">{t("modeLongAgentDesc")}</span>
                  </div>
                </DropdownMenuRadioItem>
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
          <span className="text-agent-purple font-bold shrink-0 select-none mt-1.5">
            &gt;
          </span>
          <button
            type="button"
            onClick={() => setShowWorkspaceImagePicker(true)}
            title={t("workspaceImagePickerTitle")}
            className="mt-1 shrink-0 rounded p-1 text-agent-accent transition-colors hover:bg-agent-card-hover"
            disabled={!aiEnabled || isSummarizing}
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              handleInputChange(e.target.value);
            }}
            onPaste={handleInputPaste}
            onKeyDown={(e) => {
              // Enter without Shift sends message, Shift+Enter creates new line
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !autocompleteCapturesEnter) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!aiEnabled || isSummarizing}
            placeholder={aiEnabled ? t(MODE_PLACEHOLDER_KEYS[mode]) : t("disabledState")}
            className="flex-1 bg-transparent text-agent-foreground placeholder:text-agent-muted outline-none text-sm font-mono resize-none h-full leading-6"
            rows={1}
            autoFocus
          />
          <div className="flex items-center gap-1 shrink-0 mt-1">
            {/* Buddy avatar */}
            <BuddyAvatar
              key={buddyKey}
              workspaceId={workspaceId}
              lastAssistantMessage={lastAssistantMessage}
              onHatchRequest={() => setShowBuddyHatch(true)}
            />
            {/* Cost display */}
            {showCostDisplay && <CostDisplay snapshot={costSnapshot} />}
            {/* Context usage percentage */}
            {messages.length > 0 && (
              <span
                title={t("contextUsage")}
                className={`text-[10px] font-mono tabular-nums px-1 py-0.5 rounded select-none transition-colors ${
                  contextPercent >= 80
                    ? "text-[#f7768e]"
                    : contextPercent >= 50
                    ? "text-[#e0af68]"
                    : "text-agent-muted"
                }`}
              >
                {contextPercent}%
              </span>
            )}
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
      </div>

      <WorkspaceImagePickerDialog
        open={showWorkspaceImagePicker}
        workspaceRoot={folderPath}
        onClose={() => setShowWorkspaceImagePicker(false)}
        onSelect={(filePath) => void handleWorkspaceImageSelect(filePath)}
        onCloseAutoFocus={(event) =>
          focusAgentInputAfterDialogClose(event, inputRef.current)
        }
      />

      {/* KAIROS Memory panel */}
      <MemoryPanel
        open={showMemoryPanel}
        onOpenChange={setShowMemoryPanel}
        workspaceId={workspaceId}
      />

      {/* Buddy hatch dialog */}
      <BuddyHatchDialog
        open={showBuddyHatch}
        onOpenChange={setShowBuddyHatch}
        onHatched={() => setBuddyKey((k) => k + 1)}
      />

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

      <ConversationMessageSelectionDialog
        open={showMessageSelect}
        onCancel={handleSelectCancel}
        messages={messages}
        selectedMessageIds={selectedMessageIds}
        getMessageText={getMessageText}
        onToggleMessage={toggleMessage}
        onSelectAll={() => setSelectedMessageIds(new Set(selectableMessages.map((m) => m.id)))}
        onSelectNone={() => setSelectedMessageIds(new Set())}
        onConfirm={handleSelectNext}
        onClearAll={() => {
          setShowMessageSelect(false);
          setSelectedMessageIds(new Set());
          setMessages([]);
        }}
        labels={{
          title: t("selectMessagesTitle"),
          description: t("selectMessagesDesc"),
          roleUser: t("roleUser"),
          roleAssistant: t("roleAssistant"),
          selectAll: t("selectAll"),
          selectNone: t("selectNone"),
          cancel: tCommon("cancel"),
          clearAll: t("clearAll"),
          confirm: t("nextStep"),
        }}
        selectedCount={selectedMessageIds.size}
        totalCount={selectableMessages.length}
        showCount
        variant="terminal"
        className="flex flex-col !p-0 overflow-hidden"
        style={dialogStyle}
        headerClassName="cursor-move select-none px-6 pt-6 pb-2"
        footerClassName="px-6 pb-6 pt-2"
        scrollAreaClassName="flex-1 min-h-0 px-6"
        onHeaderPointerDown={onDragStart}
        footerExtra={<ResizeHandles onEdgeResizeStart={onEdgeResizeStart} />}
      />

      <ConversationMemoryPreviewDialog
        open={showMemoryPreview}
        onCancel={handleMemoryCancel}
        titleValue={memoryPreviewTitle}
        contentValue={memoryPreviewContent}
        onTitleChange={setMemoryPreviewTitle}
        onContentChange={setMemoryPreviewContent}
        onConfirm={handleMemoryConfirm}
        confirmDisabled={!memoryPreviewTitle.trim()}
        labels={{
          title: t("memoryPreviewTitle"),
          description: t("memoryPreviewDesc"),
          cancel: tCommon("cancel"),
          confirm: tCommon("confirm"),
          memoryTitle: t("memoryNoteTitle"),
          memoryContent: t("memoryNoteContent"),
        }}
        variant="terminal"
        className="flex flex-col !p-0 overflow-hidden"
        style={dialogStyle}
        headerClassName="cursor-move select-none px-6 pt-6 pb-2"
        footerClassName="px-6 pb-6 pt-2"
        onHeaderPointerDown={onDragStart}
        footerExtra={<ResizeHandles onEdgeResizeStart={onEdgeResizeStart} />}
      />

      {/* Particle effects overlay - renders on top of content but allows click-through */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <FloatingOrbs isActive={isLoading} />
        <ParticleEffect isActive={isLoading} particleCount={25} density={0.0001} colors={["#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#a855f7", "#ec4899"]} />
      </div>
    </div>
  );
}
