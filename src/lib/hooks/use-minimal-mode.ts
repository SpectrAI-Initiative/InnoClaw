"use client";

import { useState, useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "innoclaw-minimal-mode";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getIsClient() {
  return true;
}

function getIsServer() {
  return false;
}

export function useMinimalMode() {
  const isLoaded = useSyncExternalStore(subscribe, getIsClient, getIsServer);

  const [isMinimal, setIsMinimal] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

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
