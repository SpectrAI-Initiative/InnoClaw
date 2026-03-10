"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  FolderOpen,
  FolderIcon,
  ChevronRight,
  FolderPlus,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
}

interface DirectoryPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (dir: string) => void;
}

export function DirectoryPickerDialog({
  open,
  onClose,
  onSelect,
}: DirectoryPickerDialogProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");

  const [roots, setRoots] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [dirs, setDirs] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showNewDir, setShowNewDir] = useState(false);

  // Fetch workspace roots on open
  useEffect(() => {
    if (!open) return;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const r: string[] = data.workspaceRoots || [];
        setRoots(r);
        if (r.length === 1) {
          setCurrentPath(r[0]);
        } else {
          setCurrentPath("");
        }
      })
      .catch(() => {});
  }, [open]);

  // Fetch directory contents
  const fetchDirs = useCallback(async (dir: string) => {
    if (!dir) {
      setDirs([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/files/browse?path=${encodeURIComponent(dir)}`);
      if (!res.ok) throw new Error();
      const entries: FileEntry[] = await res.json();
      setDirs(
        entries
          .filter((e) => e.type === "directory")
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch {
      setDirs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentPath) {
      fetchDirs(currentPath);
    }
  }, [currentPath, fetchDirs]);

  const handleEnterDir = (dirName: string) => {
    setCurrentPath(`${currentPath}/${dirName}`);
    setShowNewDir(false);
    setNewDirName("");
  };

  const handleGoUp = () => {
    // If at a root, go back to root selection
    if (roots.includes(currentPath)) {
      if (roots.length > 1) {
        setCurrentPath("");
      }
      return;
    }
    const parent = currentPath.substring(0, currentPath.lastIndexOf("/"));
    setCurrentPath(parent || "");
  };

  const handleCreateDir = async () => {
    const name = newDirName.trim();
    if (!name || !currentPath) return;
    setIsCreating(true);
    try {
      const newPath = `${currentPath}/${name}`;
      const res = await fetch("/api/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newPath }),
      });
      if (!res.ok) throw new Error("Failed to create directory");
      setNewDirName("");
      setShowNewDir(false);
      // Refresh and navigate into the new dir
      await fetchDirs(currentPath);
      setCurrentPath(newPath);
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirm = () => {
    if (currentPath) {
      onSelect(currentPath);
      onClose();
    }
  };

  // Compute display path relative to root
  const displayPath = (() => {
    if (!currentPath) return "";
    const matchedRoot = roots.find((r) => currentPath.startsWith(r));
    if (matchedRoot) {
      const rootName = matchedRoot.split("/").pop() || matchedRoot;
      const relative = currentPath.substring(matchedRoot.length);
      return rootName + (relative || "/");
    }
    return currentPath;
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md h-[60vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-sm font-semibold">
            {t("setDirectory")}
          </DialogTitle>
        </DialogHeader>

        {/* Current path breadcrumb */}
        {currentPath && (
          <div className="px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate" title={currentPath}>
                {displayPath}
              </span>
            </div>
          </div>
        )}

        {/* Directory list */}
        <ScrollArea className="flex-1">
          {!currentPath && roots.length > 1 ? (
            // Root selection
            <div className="p-3 space-y-1">
              <p className="text-xs text-muted-foreground mb-2 px-1">
                {t("selectRoot")}
              </p>
              {roots.map((root) => (
                <button
                  key={root}
                  onClick={() => setCurrentPath(root)}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{root.split("/").pop() || root}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                </button>
              ))}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {/* Go up */}
              {currentPath && (
                <button
                  onClick={handleGoUp}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <FolderIcon className="h-4 w-4" />
                  ..
                </button>
              )}

              {dirs.map((dir) => (
                <button
                  key={dir.name}
                  onClick={() => handleEnterDir(dir.name)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <FolderIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{dir.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                </button>
              ))}

              {dirs.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {t("noSubDirs")}
                </p>
              )}

              {/* New directory inline */}
              {showNewDir ? (
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <FolderPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={newDirName}
                    onChange={(e) => setNewDirName(e.target.value)}
                    placeholder={t("newDirPlaceholder")}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateDir();
                      if (e.key === "Escape") {
                        setShowNewDir(false);
                        setNewDirName("");
                      }
                    }}
                  />
                  <Button
                    size="icon-xs"
                    onClick={handleCreateDir}
                    disabled={!newDirName.trim() || isCreating}
                  >
                    {isCreating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewDir(true)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-primary/70 hover:bg-muted/50 transition-colors"
                >
                  <FolderPlus className="h-4 w-4" />
                  {t("newDir")}
                </button>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-4 py-3 border-t shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!currentPath}>
            <Check className="h-3.5 w-3.5 mr-1" />
            {t("confirmDirectory")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
