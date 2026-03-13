"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { PreviewTab } from "@/components/preview/preview-tabs";
import type { Article } from "@/lib/article-search/types";
import { getFileName } from "@/lib/utils";

const STORAGE_KEY_PREFIX = "innoclaw-preview-tabs-";

interface StoredState {
  tabs: PreviewTab[];
  activeTabId: string;
  tabIdCounter: number;
}

function loadState(workspaceId: string): StoredState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PREFIX + workspaceId);
    if (!raw) return null;
    return JSON.parse(raw) as StoredState;
  } catch {
    return null;
  }
}

function saveState(workspaceId: string, state: StoredState) {
  try {
    sessionStorage.setItem(STORAGE_KEY_PREFIX + workspaceId, JSON.stringify(state));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

export function usePreviewTabs(workspaceId: string) {
  const [previewTabs, setPreviewTabs] = useState<PreviewTab[]>(() => {
    return loadState(workspaceId)?.tabs ?? [];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return loadState(workspaceId)?.activeTabId ?? "notes";
  });
  const tabIdCounter = useRef<number>(loadState(workspaceId)?.tabIdCounter ?? 0);

  // Persist to sessionStorage whenever tabs or activeTabId change
  useEffect(() => {
    saveState(workspaceId, {
      tabs: previewTabs,
      activeTabId,
      tabIdCounter: tabIdCounter.current,
    });
  }, [workspaceId, previewTabs, activeTabId]);

  const openFileTab = useCallback((filePath: string | null) => {
    if (!filePath) return;
    setPreviewTabs((prev) => {
      const existing = prev.find((t) => t.type === "file" && t.filePath === filePath);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const id = `file-${++tabIdCounter.current}`;
      const tab: PreviewTab = {
        id,
        type: "file",
        label: getFileName(filePath),
        filePath,
      };
      setActiveTabId(id);
      return [...prev, tab];
    });
  }, []);

  const openArticleTab = useCallback((article: Article) => {
    setPreviewTabs((prev) => {
      const existing = prev.find((t) => t.type === "article" && t.article?.id === article.id);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const id = `article-${++tabIdCounter.current}`;
      const tab: PreviewTab = {
        id,
        type: "article",
        label: article.title.slice(0, 40),
        article,
      };
      setActiveTabId(id);
      return [...prev, tab];
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    setPreviewTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((current) => {
        if (current !== id) return current;
        if (next.length === 0) return "notes";
        const newIdx = Math.min(idx, next.length - 1);
        return next[newIdx].id;
      });
      return next;
    });
  }, []);

  return {
    previewTabs,
    activeTabId,
    setActiveTabId,
    openFileTab,
    openArticleTab,
    closeTab,
  };
}
