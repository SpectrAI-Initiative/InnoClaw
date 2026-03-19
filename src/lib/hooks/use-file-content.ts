"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

interface UseFileContentOptions {
  filePath: string;
  onLoad?: () => void;
}

export function useFileContent({ filePath, onLoad }: UseFileContentOptions) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);
  const savingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs so handleSave always reads the latest values without re-creating
  const contentRef = useRef(content);
  contentRef.current = content;
  const modifiedRef = useRef(modified);
  modifiedRef.current = modified;

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setModified(false);

    fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load file");
        return res.json();
      })
      .then((data) => {
        if (!canceled) {
          setContent(data.content);
          onLoad?.();
        }
      })
      .catch(() => {
        if (!canceled) toast.error("Failed to load file");
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => {
      canceled = true;
    };
    // onLoad is intentionally excluded from deps — callers should pass a stable callback
    // (e.g., via useCallback) if they rely on the latest closure values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  // Stable callback — only changes when filePath changes
  const handleSave = useCallback(async () => {
    if (savingRef.current || !modifiedRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: contentRef.current }),
      });
      if (!res.ok) throw new Error("Failed to save file");
      setModified(false);
      return true;
    } catch {
      toast.error("Failed to save file");
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [filePath]);

  const updateContent = useCallback((value: string) => {
    setContent(value);
    setModified(true);
  }, []);

  // Auto-save with 1.5s debounce after content changes
  useEffect(() => {
    if (!modified) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [modified, content, handleSave]);

  return { content, loading, saving, modified, handleSave, updateContent };
}
