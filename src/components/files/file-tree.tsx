"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  ChevronDown,
  File,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  Folder,
  FolderOpen,
  Trash2,
  Pencil,
  Copy,
  Scissors,
  ClipboardPaste,
  ClipboardCopy,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { FileEntry } from "@/types";

// --- Clipboard state (shared across tree nodes) ---
interface ClipboardData {
  path: string;
  name: string;
  type: "file" | "directory";
  operation: "copy" | "cut";
}

let globalClipboard: ClipboardData | null = null;
let clipboardListeners: Array<() => void> = [];

function setClipboard(data: ClipboardData | null) {
  globalClipboard = data;
  [...clipboardListeners].forEach((fn) => fn());
}

function useClipboard() {
  const [clipboard, setLocal] = useState<ClipboardData | null>(globalClipboard);
  useEffect(() => {
    const listener = () => setLocal(globalClipboard);
    clipboardListeners.push(listener);
    return () => {
      clipboardListeners = clipboardListeners.filter((fn) => fn !== listener);
    };
  }, []);
  return clipboard;
}

// --- Helpers ---

interface FileTreeProps {
  rootPath: string;
  onFileOpen: (path: string) => void;
  onRefresh: () => void;
  selectedPath: string | null;
  refreshKey?: number;
}

function getFileIcon(name: string, type: string) {
  if (type === "directory") return Folder;
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
    case "txt":
    case "csv":
      return FileText;
    case "json":
      return FileJson;
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "html":
    case "css":
      return FileCode;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return FileImage;
    default:
      return File;
  }
}

function getParentPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
}

// --- TreeNode ---

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  onFileOpen: (path: string) => void;
  onRefresh: () => void;
  selectedPath: string | null;
  refreshKey?: number;
}

function TreeNode({
  entry,
  depth,
  onFileOpen,
  onRefresh,
  selectedPath,
  refreshKey,
}: TreeNodeProps) {
  const t = useTranslations("files");
  const tCommon = useTranslations("common");
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(entry.name);
  const [dragOver, setDragOver] = useState(false);

  const clipboard = useClipboard();

  const isDirectory = entry.type === "directory";
  const isSelected = selectedPath === entry.path;
  const Icon =
    isDirectory && expanded ? FolderOpen : getFileIcon(entry.name, entry.type);

  const fetchChildren = useCallback(async () => {
    if (!isDirectory) return;
    try {
      const res = await fetch(
        `/api/files/browse?path=${encodeURIComponent(entry.path)}`
      );
      if (res.ok) {
        setChildren(await res.json());
      }
    } catch {
      // ignore
    }
  }, [isDirectory, entry.path]);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    await fetchChildren();
    setLoading(false);
  }, [fetchChildren]);

  // Re-fetch children silently when refreshKey changes and folder is expanded
  useEffect(() => {
    if (!expanded || !isDirectory) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch(
          `/api/files/browse?path=${encodeURIComponent(entry.path)}`
        );
        if (res.ok && !cancelled) {
          setChildren(await res.json());
        }
      } catch {
        // ignore
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [expanded, isDirectory, entry.path, refreshKey]);

  const toggleExpand = () => {
    if (!isDirectory) return;
    if (!expanded) {
      loadChildren();
    }
    setExpanded(!expanded);
  };

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
    };
  }, []);

  const handleClick = () => {
    if (renaming) return;
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      handleDoubleClick();
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        if (isDirectory) {
          toggleExpand();
        } else {
          onFileOpen(entry.path);
        }
      }, 250);
    }
  };

  const handleDoubleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    setNewName(entry.name);
    setRenaming(true);
  };

  const handleDelete = async () => {
    if (!confirm(t("deleteConfirm", { name: entry.name }))) return;
    try {
      await fetch("/api/files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: entry.path }),
      });
      onRefresh();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleRename = async () => {
    if (!newName || newName === entry.name) {
      setRenaming(false);
      return;
    }
    try {
      const parentPath = getParentPath(entry.path);
      const newPath = `${parentPath}/${newName}`;
      await fetch("/api/files/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath: entry.path, newPath }),
      });
      setRenaming(false);
      onRefresh();
    } catch {
      toast.error("Failed to rename");
    }
  };

  // --- Copy / Cut / Paste ---

  const handleCopy = useCallback(() => {
    setClipboard({
      path: entry.path,
      name: entry.name,
      type: entry.type,
      operation: "copy",
    });
    toast.success(t("copied", { name: entry.name }));
  }, [entry, t]);

  const handleCut = useCallback(() => {
    setClipboard({
      path: entry.path,
      name: entry.name,
      type: entry.type,
      operation: "cut",
    });
    toast.success(t("cut", { name: entry.name }));
  }, [entry, t]);

  const handlePaste = useCallback(async () => {
    if (!clipboard) return;
    const targetDir = isDirectory ? entry.path : getParentPath(entry.path);
    const destPath = `${targetDir}/${clipboard.name}`;

    if (clipboard.path === destPath) return;

    try {
      const endpoint =
        clipboard.operation === "cut" ? "/api/files/move" : "/api/files/copy";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath: clipboard.path, destPath }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Operation failed");
      }
      if (clipboard.operation === "cut") {
        setClipboard(null);
      }
      toast.success(
        clipboard.operation === "cut" ? t("moved") : t("pasted")
      );
      onRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to paste"
      );
    }
  }, [clipboard, entry, isDirectory, onRefresh, t]);

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(entry.path);
    toast.success(t("pathCopied"));
  }, [entry.path, t]);

  // --- Drag and Drop ---

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-file-path", entry.path);
    e.dataTransfer.setData("application/x-file-name", entry.name);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-file-path")) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      setDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const sourcePath = e.dataTransfer.getData("application/x-file-path");
    const sourceName = e.dataTransfer.getData("application/x-file-name");
    if (!sourcePath || !sourceName) return;

    const targetDir = isDirectory ? entry.path : getParentPath(entry.path);
    const destPath = `${targetDir}/${sourceName}`;

    if (sourcePath === destPath) return;
    if (isDirectory && sourcePath === entry.path) return;
    const normalizedTarget = targetDir.replace(/\\/g, "/").toLowerCase();
    const normalizedSource = sourcePath.replace(/\\/g, "/").toLowerCase();
    if (normalizedTarget === normalizedSource || normalizedTarget.startsWith(normalizedSource + "/")) return;

    try {
      const res = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath, destPath }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Move failed");
      }
      toast.success(t("moved"));
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move");
    }
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={`flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent min-w-0 ${
              isSelected ? "bg-accent" : ""
            } ${dragOver ? "bg-accent/60 ring-1 ring-primary" : ""}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={handleClick}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }}
            draggable={!renaming}
            onDragStart={(e) => {
              e.stopPropagation();
              handleDragStart(e);
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDirectory ? (
              expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {renaming ? (
              <Input
                className="h-6 px-1 text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate">{entry.name}</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {!isDirectory && (
            <ContextMenuItem onClick={() => onFileOpen(entry.path)}>
              {tCommon("open")}
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {t("copy")}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCut}>
            <Scissors className="mr-2 h-4 w-4" />
            {t("cutItem")}
          </ContextMenuItem>
          {clipboard && (
            <ContextMenuItem onClick={handlePaste}>
              <ClipboardPaste className="mr-2 h-4 w-4" />
              {t("paste")}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyPath}>
            <ClipboardCopy className="mr-2 h-4 w-4" />
            {t("copyPath")}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              setNewName(entry.name);
              setRenaming(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {t("rename")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("delete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded && isDirectory && (
        <div>
          {loading ? (
            <div
              className="py-1 text-xs text-muted-foreground"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              {tCommon("loading")}
            </div>
          ) : children.length === 0 ? (
            <div
              className="py-1 text-xs text-muted-foreground"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              {t("emptyFolder")}
            </div>
          ) : (
            children.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                onFileOpen={onFileOpen}
                onRefresh={onRefresh}
                selectedPath={selectedPath}
                refreshKey={refreshKey}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  rootPath,
  onFileOpen,
  onRefresh,
  selectedPath,
  refreshKey,
}: FileTreeProps) {
  const t = useTranslations("files");
  const tCommon = useTranslations("common");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadRoot = async () => {
      try {
        const res = await fetch(
          `/api/files/browse?path=${encodeURIComponent(rootPath)}`
        );
        if (res.ok) {
          setEntries(await res.json());
        }
      } catch {
        // ignore
      } finally {
        setInitialLoading(false);
      }
    };
    loadRoot();
  }, [rootPath, refreshKey]);

  if (initialLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {tCommon("loading")}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t("emptyFolder")}
      </div>
    );
  }

  return (
    <div className="py-2">
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          onFileOpen={onFileOpen}
          onRefresh={onRefresh}
          selectedPath={selectedPath}
          refreshKey={refreshKey}
        />
      ))}
    </div>
  );
}
