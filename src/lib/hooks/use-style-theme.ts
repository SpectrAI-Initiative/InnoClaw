"use client";

import { useState, useCallback } from "react";

export type StyleThemeId = "default" | "cartoon" | "cyberpunk-pixel" | "retro-handheld";

const STORAGE_KEY = "style-theme";
const VALID_THEMES: Set<string> = new Set<string>(["cartoon", "cyberpunk-pixel", "retro-handheld"]);

function applyStyleTheme(theme: StyleThemeId) {
  if (theme === "default") {
    delete document.documentElement.dataset.style;
  } else {
    document.documentElement.dataset.style = theme;
  }
}

export function useStyleTheme() {
  const [styleTheme, setStyleThemeState] = useState<StyleThemeId>("default");
  const [didInit, setDidInit] = useState(false);

  // Read initial value from DOM (set by inline script) on first client render.
  // Uses "adjust state during render" pattern instead of useEffect to avoid
  // cascading renders (react-hooks/set-state-in-effect).
  if (!didInit && typeof document !== "undefined") {
    setDidInit(true);
    const current = document.documentElement.dataset.style;
    if (current && VALID_THEMES.has(current)) {
      setStyleThemeState(current as StyleThemeId);
    }
  }

  const setStyleTheme = useCallback((theme: StyleThemeId) => {
    setStyleThemeState(theme);
    applyStyleTheme(theme);

    // Persist to localStorage
    try {
      if (theme === "default") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch {
      // localStorage may be unavailable
    }

    // Persist to DB (fire-and-forget)
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style_theme: theme }),
    }).catch(() => {});
  }, []);

  return { styleTheme, setStyleTheme } as const;
}
