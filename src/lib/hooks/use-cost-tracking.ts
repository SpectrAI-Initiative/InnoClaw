"use client";

import { useRef, useState, useEffect } from "react";
import type { UIMessage } from "ai";
import { CostTracker, type CostSnapshot } from "@/lib/agent/cost-tracker";
import { getMessageText } from "@/components/agent/message-utils";

interface UseCostTrackingOptions {
  storageKey: string;
  messages: UIMessage[];
  status: string;
  resolvedModel: string;
}

export function useCostTracking({
  storageKey,
  messages,
  status,
  resolvedModel,
}: UseCostTrackingOptions) {
  const costTrackerRef = useRef(new CostTracker());
  const [costSnapshot, setCostSnapshot] = useState<CostSnapshot | null>(null);
  const prevMessageCountRef = useRef(0);

  // Restore cost tracker from localStorage on mount / key change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved) as CostSnapshot;
        costTrackerRef.current = CostTracker.fromJSON(data);
        setCostSnapshot(costTrackerRef.current.getSnapshot());
      } else {
        costTrackerRef.current = new CostTracker();
        setCostSnapshot(null);
      }
    } catch {
      costTrackerRef.current = new CostTracker();
      setCostSnapshot(null);
    }
    // Sync message counter so already-persisted messages are not re-counted
    prevMessageCountRef.current = messages.length;
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps -- messages intentionally read once at restore

  // Estimate cost from messages using character-based token estimation (~4 chars/token)
  useEffect(() => {
    if (status === "streaming" || status === "submitted") return;
    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    const newMessages = messages.slice(prevMessageCountRef.current);
    prevMessageCountRef.current = messages.length;

    let inputChars = 0;
    let outputChars = 0;
    for (const msg of newMessages) {
      const textLen = getMessageText(msg).length;
      if (msg.role === "user") inputChars += textLen;
      else outputChars += textLen;
    }

    if (inputChars + outputChars > 0) {
      const model = resolvedModel ?? "unknown";
      costTrackerRef.current.addUsage(model, {
        inputTokens: Math.ceil(inputChars / 4),
        outputTokens: Math.ceil(outputChars / 4),
      });
      const snapshot = costTrackerRef.current.getSnapshot();
      setCostSnapshot(snapshot);
      try {
        localStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch { /* ignore */ }
    }
  }, [messages, status, resolvedModel, storageKey]);

  return { costSnapshot };
}
