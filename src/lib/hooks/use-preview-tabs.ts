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

  // Keep a ref to the latest tabs so callbacks always see current state
  const tabsRef = useRef(previewTabs);
  useEffect(() => {
    tabsRef.current = previewTabs;
  }, [previewTabs]);

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
    const current = tabsRef.current;
    const existing = current.find((t) => t.type === "file" && t.filePath === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const id = `file-${++tabIdCounter.current}`;
    const tab: PreviewTab = {
      id,
      type: "file",
      label: getFileName(filePath),
      filePath,
    };
    const next = [...current, tab];
    tabsRef.current = next;
    setPreviewTabs(next);
    setActiveTabId(id);
  }, []);

  const openArticleTab = useCallback((article: Article) => {
    const current = tabsRef.current;
    const existing = current.find((t) => t.type === "article" && t.article?.id === article.id);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const id = `article-${++tabIdCounter.current}`;
    const tab: PreviewTab = {
      id,
      type: "article",
      label: article.title.slice(0, 40),
      article,
    };
    const next = [...current, tab];
    tabsRef.current = next;
    setPreviewTabs(next);
    setActiveTabId(id);
  }, []);

  const closeTab = useCallback((id: string) => {
    const current = tabsRef.current;
    const idx = current.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const next = current.filter((t) => t.id !== id);
    setPreviewTabs(next);
    setActiveTabId((currentActiveId) => {
      if (currentActiveId !== id) return currentActiveId;
      if (next.length === 0) return "notes";
      const newIdx = Math.min(idx, next.length - 1);
      return next[newIdx].id;
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
