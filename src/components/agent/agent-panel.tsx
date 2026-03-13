"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { agentStreamManager } from "@/lib/agent/agent-stream-manager";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  Bot,
  ChevronDown,
  Loader2,
  Square,
  Brain,
  ClipboardList,
  MessageCircleQuestion,
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
import { useSkills } from "@/lib/hooks/use-skills";
import { getOverflowThresholdChars, getMessageTextLength, PROVIDERS } from "@/lib/ai/models";
import type { ProviderId } from "@/lib/ai/models";
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
import { ParticleEffect, ThinkingIndicator, FloatingOrbs } from "@/components/ui/particle-effect";
import type { Skill } from "@/types";
import { swrFetcher as fetcher } from "@/lib/fetcher";
import { AgentMessage } from "./agent-message";

type AgentMode = "agent" | "plan" | "ask";

/** Pixel threshold for considering the user "at the bottom" of the scroll area */
const BOTTOM_THRESHOLD_PX = 80;

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
  workspaceName,
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
  const [mode, setMode] = useState<AgentMode>("agent");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const MODEL_SELECTION_STORAGE_KEY = "innoclaw-agent-model-selection";

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

  // Initialize model selection from localStorage, then fall back to global settings
  useEffect(() => {
    if (selectedProvider !== null) return; // already initialized

    // Try to read a stored selection from localStorage
    let storedSelection: { provider: string; model: string } | null = null;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = window.localStorage.getItem(MODEL_SELECTION_STORAGE_KEY);
        if (stored) {
          try {
            storedSelection = JSON.parse(stored);
          } catch {
            // Ignore parse errors and treat as no stored selection
          }
        }
      }
    } catch {
      // Ignore storage access errors and fall back to settings
    }

    const configuredProviders = settings?.configuredProviders as string[] | undefined;

    const isValidSelection = (selection: { provider: string; model: string } | null) => {
      if (!selection) return false;
      const { provider, model } = selection;
      if (!provider || !model) return false;
      const providerDef = PROVIDERS[provider as ProviderId];
      if (!providerDef) return false;
      if (configuredProviders && !configuredProviders.includes(provider)) return false;
      const hasModel = providerDef.models.some((m) => m.id === model);
      return hasModel;
    };

    if (isValidSelection(storedSelection)) {
      setSelectedProvider(storedSelection!.provider);
      setSelectedModel(storedSelection!.model);
      return;
    } else if (storedSelection) {
      // Clear invalid stored value
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(MODEL_SELECTION_STORAGE_KEY);
        }
      } catch {
        // Ignore storage access errors
      }
    }

    // Fall back to global settings if available and valid
    if (settings?.llmProvider && settings?.llmModel) {
      const fallbackSelection = {
        provider: settings.llmProvider as string,
        model: settings.llmModel as string,
      };
      if (isValidSelection(fallbackSelection)) {
        setSelectedProvider(fallbackSelection.provider);
        setSelectedModel(fallbackSelection.model);
      }
    }
  }, [settings?.llmProvider, settings?.llmModel, settings?.configuredProviders, selectedProvider]);

  const handleModelChange = useCallback((providerId: string, modelId: string) => {
    setSelectedProvider(providerId);
    setSelectedModel(modelId);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(
          MODEL_SELECTION_STORAGE_KEY,
          JSON.stringify({ provider: providerId, model: modelId })
        );
      }
    } catch {
      // Ignore storage access errors; state has already been updated
    }
  }, []);

  const modelDisplayName = useMemo(() => {
    if (!selectedProvider || !selectedModel) return t("modelLabel");
    const provider = PROVIDERS[selectedProvider as ProviderId];
    const model = provider?.models.find((m) => m.id === selectedModel);
    return model?.name ?? selectedModel;
  }, [selectedProvider, selectedModel, t]);

  const availableProviders = useMemo(() => {
    const configured = settings?.configuredProviders as string[] | undefined;
    if (!configured) return [];
    return configured
      .map((id: string) => PROVIDERS[id as ProviderId])
      .filter(Boolean);
  }, [settings?.configuredProviders]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const storageKey = `agent-messages:${workspaceId}:${sessionId}:${mode}`;
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
          localStorage.setItem(storageKey, JSON.stringify(toSave));
        } catch { /* ignore */ }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamKey, storageKey, setMessages]);

  // --- Auto-continue: automatically continue when task is incomplete ---
  const prevStatusRef = useRef(status);
  const autoContinueCountRef = useRef(0);
  const autoContinueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_AUTO_CONTINUES = 20; // Prevent infinite loops

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
    const lastPart = parts.length > 0 ? parts[parts.length - 1] : undefined;
    const endsWithToolCall = lastPart != null && (
      lastPart.type?.startsWith("tool-") || lastPart.type === "dynamic-tool"
    );

    // Only auto-continue when the last assistant message ends with a tool call,
    // indicating the task is incomplete. Pure-text endings are treated as
    // completed — the model is done talking.
    if (!endsWithToolCall) {
      // Reset the auto-continue counter when we see a pure-text response,
      // so we don't keep auto-continuing based on stale state.
      autoContinueCountRef.current = 0;
      return;
    }

    autoContinueCountRef.current++;
    autoContinueTimerRef.current = setTimeout(() => {
      sendMessage({ text: t("autoContinue") });
    }, 500);
    return () => {
      if (autoContinueTimerRef.current) {
        clearTimeout(autoContinueTimerRef.current);
        autoContinueTimerRef.current = null;
      }
    };
  }, [status, messages, sendMessage, t]);
  const overflowThreshold = getOverflowThresholdChars(
    selectedProvider ?? settings?.llmProvider ?? "openai",
    selectedModel ?? settings?.llmModel ?? "gpt-4o-mini",
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
          sessionName,
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
    agentBody.llmProvider = selectedProvider;
    agentBody.llmModel = selectedModel;

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
    userScrolledUp.current = false;

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
    agentBody.llmProvider = selectedProvider;
    agentBody.llmModel = selectedModel;
    await sendMessage({ text });
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
          sessionName,
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
    <div ref={containerRef} className="relative flex h-full min-w-0 flex-col bg-agent-bg text-agent-foreground font-mono text-sm overflow-hidden">
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
              // Filter out auto-continue messages (user messages with only "继续")
              if (message.role === "user") {
                const text = message.parts
                  ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p) => p.text)
                  .join("")
                  .trim();
                if (text === "继续") return null;
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
      <div className="relative z-10 bg-agent-bg/80 backdrop-blur-sm shrink-0 overflow-hidden" style={{ height: inputHeight }}>
        {/* Slash command autocomplete */}
        {showAutocomplete && availableSkills.length > 0 && (
          <SkillAutocomplete
            query={slashQuery}
            skills={availableSkills}
            onSelect={handleSkillSelect}
            onClose={() => setShowAutocomplete(false)}
          />
        )}

        <div className="flex items-start gap-2 px-3 py-2 h-full">
          {/* Model selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-xs text-agent-accent hover:bg-agent-card-hover transition-colors mt-1.5 max-w-[120px]">
                <span className="truncate">{modelDisplayName}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
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
                        {model.name}
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
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              handleInputChange(e.target.value);
            }}
            onKeyDown={(e) => {
              // Enter without Shift sends message, Shift+Enter creates new line
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !showAutocomplete) {
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

      {/* Particle effects overlay - renders on top of content but allows click-through */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <FloatingOrbs isActive={isLoading} />
        <ParticleEffect isActive={isLoading} particleCount={80} density={0.0003} colors={["#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#a855f7", "#ec4899"]} />
      </div>
    </div>
  );
}
