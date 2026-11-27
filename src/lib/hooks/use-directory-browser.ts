import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { FileEntry } from "@/types";

/**
 * Shared directory-browsing logic for workspace dialogs.
 * Handles path input, browsing, and state reset.
 */
export function useDirectoryBrowser(defaultBrowsePath?: string) {
  const [manualPath, setManualPath] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const browsePath = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/files/browse?path=${encodeURIComponent(dirPath)}`
      );
      if (!res.ok) {
        let message = "无法打开该目录";
        try {
          const err = await res.json();
          if (typeof err?.error === "string" && err.error.trim()) message = err.error;
        } catch { /* ignore */ }
        throw new Error(message);
      }
      const data = await res.json();
      setEntries(data.filter((e: FileEntry) => e.type === "directory"));
      setCurrentPath(dirPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法打开该目录");
    } finally {
      setLoading(false);
    }
  }, []);

  const browse = useCallback(() => {
    const target = manualPath.trim() || defaultBrowsePath || "";
    if (target) browsePath(target);
  }, [manualPath, defaultBrowsePath, browsePath]);

  const goBack = useCallback(() => {
    setCurrentPath("");
    setEntries([]);
  }, []);

  const reset = useCallback(() => {
    setManualPath("");
    setCurrentPath("");
    setEntries([]);
  }, []);

  return {
    manualPath,
    setManualPath,
    currentPath,
    entries,
    loading,
    browsePath,
    browse,
    goBack,
    reset,
  };
}
