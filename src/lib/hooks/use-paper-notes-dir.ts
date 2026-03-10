"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "paperStudy.notesDir";

function getStoredNotesDir(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function usePaperNotesDir() {
  const [notesDir, setNotesDirState] = useState(getStoredNotesDir);

  const setNotesDir = useCallback((dir: string) => {
    const trimmed = dir.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setNotesDirState(trimmed);
  }, []);

  return { notesDir, setNotesDir };
}
