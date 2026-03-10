"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "paperStudy.notesDir";

export function usePaperNotesDir() {
  const [notesDir, setNotesDirState] = useState("");

  // Read from localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || "";
    if (saved) {
      setNotesDirState(saved);
    }
  }, []);

  const setNotesDir = useCallback((dir: string) => {
    const trimmed = dir.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setNotesDirState(trimmed);
  }, []);

  return { notesDir, setNotesDir };
}
