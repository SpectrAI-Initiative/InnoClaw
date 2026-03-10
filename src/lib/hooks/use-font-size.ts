"use client";

import { useEffect, useState, useCallback } from "react";
import { FONT_SIZE_KEY, MIN_FONT_SIZE, MAX_FONT_SIZE } from "@/lib/font-constants";

const DEFAULT_FONT_SIZE = 16;
const STEP = 2;

export function useFontSize() {
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  useEffect(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (!isNaN(parsed) && parsed >= MIN_FONT_SIZE && parsed <= MAX_FONT_SIZE) {
        setFontSize(parsed);
        document.documentElement.style.fontSize = `${parsed}px`;
      }
    }
  }, []);

  const updateFontSize = useCallback((size: number) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
    setFontSize(clamped);
    localStorage.setItem(FONT_SIZE_KEY, String(clamped));
    document.documentElement.style.fontSize = `${clamped}px`;
  }, []);

  const increase = useCallback(() => updateFontSize(fontSize + STEP), [fontSize, updateFontSize]);
  const decrease = useCallback(() => updateFontSize(fontSize - STEP), [fontSize, updateFontSize]);
  const reset = useCallback(() => updateFontSize(DEFAULT_FONT_SIZE), [updateFontSize]);

  return {
    fontSize,
    setFontSize: updateFontSize,
    increase,
    decrease,
    reset,
    min: MIN_FONT_SIZE,
    max: MAX_FONT_SIZE,
    step: STEP,
  };
}
