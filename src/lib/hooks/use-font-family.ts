"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FONT_FAMILY_KEY,
  DEFAULT_FONT,
  FONT_OPTIONS,
  WEB_FONT_URLS,
  type FontId,
} from "@/lib/font-constants";

export type { FontId } from "@/lib/font-constants";
export { FONT_OPTIONS } from "@/lib/font-constants";

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
