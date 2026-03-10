"use client";

import { useSyncExternalStore, useCallback } from "react";
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

let listeners: Array<() => void> = [];
function emitChange() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners = [...listeners, cb];
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function getSnapshot(): FontId {
  try {
    const stored = localStorage.getItem(FONT_FAMILY_KEY) as FontId | null;
    if (stored && FONT_OPTIONS.some((f) => f.id === stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_FONT;
}

function getServerSnapshot(): FontId {
  return DEFAULT_FONT;
}

export function useFontFamily() {
  const fontFamily = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updateFontFamily = useCallback((id: FontId) => {
    try {
      localStorage.setItem(FONT_FAMILY_KEY, id);
    } catch {
      // Ignore storage errors; font will still be applied for this session
    }
    applyFont(id);
    emitChange();
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
