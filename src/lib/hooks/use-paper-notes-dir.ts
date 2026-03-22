"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "paperStudy.notesDir";

export function usePaperNotesDir() {
  const [notesDir, setNotesDirState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  // Fallback: if nothing in localStorage, try loading from backend config
  useEffect(() => {
    if (notesDir) return;

    fetch("/api/paper-study/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((config) => {
        if (config?.paths?.obsidian_vault) {
          const vault = config.paths.obsidian_vault;
          const subfolder = config.paths.paper_notes_folder || "";
          const dir = subfolder ? `${vault}/${subfolder}` : vault;
          setNotesDirState(dir);
        }
      })
      .catch(() => {
        // Config endpoint not available — ignore
      });
  }, [notesDir]);

  const setNotesDir = useCallback((dir: string) => {
    const trimmed = dir.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setNotesDirState(trimmed);
  }, []);

  return { notesDir, setNotesDir };
}
