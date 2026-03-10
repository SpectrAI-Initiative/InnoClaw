"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  FolderOpen,
  FolderCog,
  Sparkles,
  Loader2,
  FileText,
  RefreshCw,
  ChevronRight,
  FolderIcon,
  Pencil,
  MessageSquare,
  Trash2,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { DirectoryPickerDialog } from "./directory-picker-dialog";
import { NoteDiscussionDialog } from "./note-discussion-dialog";

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
}

interface PaperNotesPanelProps {
  notesDir: string;
  onSetNotesDir: (dir: string) => void;
}

export function PaperNotesPanel({ notesDir, onSetNotesDir }: PaperNotesPanelProps) {
  const t = useTranslations("paperStudy");
  const tCommon = useTranslations("common");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [currentPath, setCurrentPath] = useState(notesDir);

  // Edit state
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Discuss state
  const [discussFile, setDiscussFile] = useState<{
    path: string;
    name: string;
    content: string;
  } | null>(null);

  // Fetch file list
  const fetchFiles = useCallback(async (dir: string) => {
    if (!dir) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/files/browse?path=${encodeURIComponent(dir)}`);
      if (!res.ok) throw new Error("Failed to browse directory");
      const entries: FileEntry[] = await res.json();
      setFiles(
        entries.filter((e) => e.type === "directory" || e.name.endsWith(".md"))
          .sort((a, b) => {
            if (a.type === "directory" && b.type !== "directory") return -1;
            if (a.type !== "directory" && b.type === "directory") return 1;
            return a.name.localeCompare(b.name);
          })
      );
    } catch {
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (notesDir) {
      setCurrentPath(notesDir);
      fetchFiles(notesDir);
    }
  }, [notesDir, fetchFiles]);

  useEffect(() => {
    if (currentPath) {
      fetchFiles(currentPath);
    }
  }, [currentPath, fetchFiles]);

  const handleDirectorySelected = (dir: string) => {
    onSetNotesDir(dir);
    toast.success(t("directorySet"));
  };

  const readFileContent = async (filePath: string): Promise<string> => {
    const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return typeof data === "string" ? data : data.content || "";
  };

  const handlePreviewFile = async (fileName: string) => {
    const filePath = `${currentPath}/${fileName}`;
    if (previewFile === filePath) {
      setPreviewFile(null);
      setEditingFile(null);
      return;
    }
    try {
      const content = await readFileContent(filePath);
      setPreviewContent(content);
      setPreviewFile(filePath);
      setEditingFile(null);
    } catch {
      toast.error(tCommon("error"));
    }
  };

  const handleEnterDir = (dirName: string) => {
    setPreviewFile(null);
    setEditingFile(null);
    setCurrentPath(`${currentPath}/${dirName}`);
  };

  const handleGoUp = () => {
    if (currentPath === notesDir) return;
    setPreviewFile(null);
    setEditingFile(null);
    const parent = currentPath.substring(0, currentPath.lastIndexOf("/"));
    setCurrentPath(parent || notesDir);
  };

  // Edit handlers
  const handleStartEdit = async (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filePath = `${currentPath}/${fileName}`;
    try {
      const content = await readFileContent(filePath);
      setPreviewContent(content);
      setPreviewFile(filePath);
      setEditContent(content);
      setEditingFile(filePath);
    } catch {
      toast.error(tCommon("error"));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingFile) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: editingFile, content: editContent }),
      });
      if (!res.ok) throw new Error("Write failed");
      setPreviewContent(editContent);
      setEditingFile(null);
      toast.success(t("noteSaved"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingFile(null);
    setEditContent("");
  };

  // Discuss handler
  const handleStartDiscuss = async (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filePath = `${currentPath}/${fileName}`;
    try {
      const content = await readFileContent(filePath);
      setDiscussFile({ path: filePath, name: fileName, content });
    } catch {
      toast.error(tCommon("error"));
    }
  };

  // Delete handler
  const handleDeleteFile = async (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("deleteNoteConfirm", { name: fileName }))) return;
    const filePath = `${currentPath}/${fileName}`;
    try {
      const res = await fetch("/api/files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      });
      if (!res.ok) throw new Error("Delete failed");
      if (previewFile === filePath) {
        setPreviewFile(null);
        setEditingFile(null);
      }
      fetchFiles(currentPath);
    } catch {
      toast.error(tCommon("error"));
    }
  };

  const handleOrganize = async () => {
    if (!notesDir) return;
    setIsOrganizing(true);
    try {
      const dryRes = await fetch("/api/paper-study/organize-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notesDir, dryRun: true }),
      });
      if (!dryRes.ok) {
        const err = await dryRes.json().catch(() => ({}));
        throw new Error(err.error || "Organize failed");
      }
      const dryData = await dryRes.json();
      if (!dryData.categories || dryData.categories.length === 0) {
        toast.info(t("organizeEmpty"));
        return;
      }

      const categoryList = dryData.categories
        .map((c: { name: string; files: string[] }) => `${c.name}: ${c.files.length} files`)
        .join("\n");
      if (!confirm(`${t("organizeConfirm")}\n\n${categoryList}`)) {
        return;
      }

      const execRes = await fetch("/api/paper-study/organize-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notesDir, dryRun: false }),
      });
      if (!execRes.ok) throw new Error("Organize failed");
      const execData = await execRes.json();
      toast.success(t("organizeComplete", { count: execData.categories?.length || 0 }));
      setCurrentPath(notesDir);
      fetchFiles(notesDir);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setIsOrganizing(false);
    }
  };

  // Show directory setup if not configured
  if (!notesDir) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground text-center">
          {t("noDirectory")}
        </p>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <FolderCog className="h-3.5 w-3.5 mr-1" />
          {t("setDirectory")}
        </Button>
        <DirectoryPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleDirectorySelected}
        />
      </div>
    );
  }

  const isInSubDir = currentPath !== notesDir;
  const relativePath = isInSubDir
    ? currentPath.substring(notesDir.length)
    : "/";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate" title={notesDir}>
              {relativePath}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPickerOpen(true)}
              title={t("changeDirectory")}
            >
              <FolderCog className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => fetchFiles(currentPath)}
              title={tCommon("refresh")}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="outline"
            onClick={handleOrganize}
            disabled={isOrganizing}
            className="gap-1 text-xs"
          >
            {isOrganizing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {isOrganizing ? t("organizing") : t("organize")}
          </Button>
        </div>
      </div>

      {/* File list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">{t("noNoteFiles")}</p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {isInSubDir && (
              <button
                onClick={handleGoUp}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <FolderIcon className="h-3.5 w-3.5" />
                ..
              </button>
            )}
            {files.map((file) => (
              <div key={file.name}>
                <div
                  className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50 cursor-pointer ${
                    previewFile === `${currentPath}/${file.name}`
                      ? "bg-muted"
                      : ""
                  }`}
                  onClick={() =>
                    file.type === "directory"
                      ? handleEnterDir(file.name)
                      : handlePreviewFile(file.name)
                  }
                >
                  {file.type === "directory" ? (
                    <FolderIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate flex-1 text-left">{file.name}</span>
                  {file.type === "directory" ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                  ) : (
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => handleStartEdit(file.name, e)}
                        title={t("editNote")}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => handleStartDiscuss(file.name, e)}
                        title={t("discussNote")}
                      >
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => handleDeleteFile(file.name, e)}
                        title={t("deleteNote")}
                        className="hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {previewFile === `${currentPath}/${file.name}` && (
                  <div className="mx-2 mt-1 mb-2 rounded border bg-muted/30 p-3 max-h-60 overflow-auto">
                    {editingFile === `${currentPath}/${file.name}` ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[150px] text-xs font-mono"
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                            className="gap-1 text-xs"
                          >
                            <X className="h-3 w-3" />
                            {tCommon("cancel")}
                          </Button>
                          <Button
                            size="xs"
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                            className="gap-1 text-xs"
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                            {isSaving ? t("saving") : tCommon("save")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                        <ReactMarkdown>{previewContent}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Directory picker dialog */}
      <DirectoryPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleDirectorySelected}
      />

      {/* Note discussion dialog */}
      {discussFile && (
        <NoteDiscussionDialog
          open={!!discussFile}
          onClose={() => setDiscussFile(null)}
          noteTitle={discussFile.name}
          noteContent={discussFile.content}
          noteFilePath={discussFile.path}
        />
      )}
    </div>
  );
}
