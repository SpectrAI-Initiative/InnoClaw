"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { FileEntry } from "@/types";

interface FileTreeProps {
  rootPath: string;
  onFileOpen: (path: string) => void;
  onRefresh: () => void;
  selectedPath: string | null;
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

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  onFileOpen: (path: string) => void;
  onRefresh: () => void;
  selectedPath: string | null;
}

function TreeNode({
  entry,
  depth,
  onFileOpen,
  onRefresh,
  selectedPath,
}: TreeNodeProps) {
  const t = useTranslations("files");
  const tCommon = useTranslations("common");
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(entry.name);

  const isDirectory = entry.type === "directory";
  const isSelected = selectedPath === entry.path;
  const Icon = isDirectory && expanded ? FolderOpen : getFileIcon(entry.name, entry.type);

  const loadChildren = async () => {
    if (!isDirectory) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/files/browse?path=${encodeURIComponent(entry.path)}`
      );
      if (res.ok) {
        setChildren(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = () => {
    if (!isDirectory) return;
    if (!expanded) {
      loadChildren();
    }
    setExpanded(!expanded);
  };

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up click timer on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    };
  }, []);

  const handleClick = () => {
    if (renaming) return;
    // Use a timer to distinguish single vs double click
    if (clickTimer.current) {
      // Second click within the timeout window → double click
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      handleDoubleClick();
    } else {
      // First click → wait to see if a second click follows
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
      const parentPath = entry.path
        .replace(/\\/g, "/")
        .split("/")
        .slice(0, -1)
        .join("/");
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

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={`flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-sm hover:bg-accent ${
              isSelected ? "bg-accent" : ""
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={handleClick}
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
          <ContextMenuItem
            onClick={() => {
              setNewName(entry.name);
              setRenaming(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {t("rename")}
          </ContextMenuItem>
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
}: FileTreeProps) {
  const t = useTranslations("files");
  const tCommon = useTranslations("common");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRoot = async () => {
      setLoading(true);
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
        setLoading(false);
      }
    };
    loadRoot();
  }, [rootPath]);

  if (loading) {
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
        />
      ))}
    </div>
  );
}
