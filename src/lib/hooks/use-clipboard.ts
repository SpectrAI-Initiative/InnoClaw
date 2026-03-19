"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export function useClipboard(timeoutMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(
          () => setCopied(false),
          timeoutMs,
        );
        return true;
      } catch {
        return false;
      }
    },
    [timeoutMs],
  );

  return { copied, copy };
}
