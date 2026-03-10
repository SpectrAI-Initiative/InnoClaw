"use client";

import { useEffect, useState, useCallback } from "react";

const FONT_FAMILY_KEY = "innoclaw-font-family";
const DEFAULT_FONT = "geist";

export const FONT_OPTIONS = [
  { id: "geist", name: "Geist", value: "var(--font-geist-sans), sans-serif" },
  { id: "system", name: "System", value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { id: "inter", name: "Inter", value: "'Inter', sans-serif" },
  { id: "noto-sans", name: "Noto Sans", value: "'Noto Sans', 'Noto Sans SC', sans-serif" },
  { id: "roboto", name: "Roboto", value: "'Roboto', sans-serif" },
  { id: "lato", name: "Lato", value: "'Lato', sans-serif" },
  { id: "source-han", name: "Source Han Sans", value: "'Source Han Sans SC', 'Noto Sans SC', sans-serif" },
] as const;

export type FontId = (typeof FONT_OPTIONS)[number]["id"];

const WEB_FONT_URLS: Partial<Record<FontId, string>> = {
  inter: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
  "noto-sans": "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap",
  roboto: "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap",
  lato: "https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap",
  "source-han": "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap",
};

function loadWebFont(fontId: FontId) {
  const url = WEB_FONT_URLS[fontId];
  if (!url) return;
  const linkId = `innoclaw-font-${fontId}`;
  if (document.getElementById(linkId)) return;
  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

function applyFont(fontId: FontId) {
  const option = FONT_OPTIONS.find((f) => f.id === fontId);
  if (!option) return;
  loadWebFont(fontId);
  document.documentElement.style.setProperty("--font-override", option.value);
  document.body.style.fontFamily = option.value;
}

export function useFontFamily() {
  const [fontFamily, setFontFamily] = useState<FontId>(DEFAULT_FONT);

  useEffect(() => {
    const stored = localStorage.getItem(FONT_FAMILY_KEY) as FontId | null;
    if (stored && FONT_OPTIONS.some((f) => f.id === stored)) {
      setFontFamily(stored);
      applyFont(stored);
    }
  }, []);

  const updateFontFamily = useCallback((id: FontId) => {
    setFontFamily(id);
    localStorage.setItem(FONT_FAMILY_KEY, id);
    applyFont(id);
  }, []);

  const reset = useCallback(() => {
    updateFontFamily(DEFAULT_FONT);
  }, [updateFontFamily]);

  return {
    fontFamily,
    setFontFamily: updateFontFamily,
    reset,
    options: FONT_OPTIONS,
  };
}
