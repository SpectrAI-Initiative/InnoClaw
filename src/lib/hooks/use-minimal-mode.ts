"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "notebooklm-minimal-mode";

export function useMinimalMode() {
  const [isMinimal, setIsMinimal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") {
        setIsMinimal(true);
      }
    } catch {
      // localStorage not available
    }
    setIsLoaded(true);
  }, []);

  const toggleMinimalMode = useCallback(() => {
    setIsMinimal((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // localStorage not available
      }
      return next;
    });
  }, []);

  const setMinimalMode = useCallback((value: boolean) => {
    setIsMinimal(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // localStorage not available
    }
  }, []);

  return { isMinimal: isLoaded && isMinimal, isLoaded, toggleMinimalMode, setMinimalMode };
}
