"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Upload,
  FilePlus,
  FolderPlus,
  RefreshCw,
  GitPullRequest,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { getFileName } from "@/lib/utils";
import { FileTree } from "./file-tree";
import { FileEditor } from "./file-editor";
import { PdfViewer } from "./pdf-viewer";
import { MolViewer } from "./mol-viewer";
import { UploadZone } from "./upload-zone";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface FileBrowserProps {
  workspaceId: string;
  folderPath: string;
  isGitRepo: boolean;
  onFileSelect: (path: string | null) => void;
  selectedFilePath: string | null;
}

export function FileBrowser({
  workspaceId,
  folderPath,
  isGitRepo,
  onFileSelect,
  selectedFilePath,
}: FileBrowserProps) {
  const t = useTranslations("files");
  const tWorkspace = useTranslations("workspace");
  const tGit = useTranslations("git");
  const tCommon = useTranslations("common");

  const [showUpload, setShowUpload] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newName, setNewName] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [viewingMol, setViewingMol] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sync`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Sync failed");
      const result = await res.json();
      toast.success(
        `${tWorkspace("syncComplete")}: ${result.newCount} new, ${result.updatedCount} updated, ${result.removedCount} removed`
      );
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handlePull = async () => {
    setPulling(true);
    try {
      const res = await fetch("/api/git/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) throw new Error("Pull failed");
      toast.success(tGit("pullSuccess"));
      refresh();
      // Auto-sync after pull
      handleSync();
    } catch {
      toast.error("Pull failed");
    } finally {
      setPulling(false);
    }
  };

  const handleNewFile = async () => {
    if (!newName) return;
    try {
      const filePath = `${folderPath}/${newName}`;
      await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: "" }),
      });
      setShowNewFile(false);
      setNewName("");
      refresh();
    } catch {
      toast.error("Failed to create file");
    }
  };

  const handleNewFolder = async () => {
    if (!newName) return;
    try {
      const dirPath = `${folderPath}/${newName}`;
      await fetch("/api/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dirPath }),
      });
      setShowNewFolder(false);
      setNewName("");
      refresh();
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const handleFileOpen = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    const editableExts = [
      "txt",
      "md",
      "json",
      "csv",
      "html",
      "css",
      "js",
      "ts",
      "tsx",
      "jsx",
      "py",
      "yaml",
      "yml",
      "xml",
      "toml",
      "ini",
      "cfg",
      "env",
      "sh",
      "bat",
    ];
    const molExts = ["pdb", "mol", "mol2", "sdf", "sd", "xyz", "cif"];

    if (ext === "pdf") {
      setViewingMol(null);
      setViewingPdf(path);
    } else if (ext && molExts.includes(ext)) {
      setViewingPdf(null);
      setViewingMol(path);
    } else if (ext && editableExts.includes(ext)) {
      setEditingFile(path);
    }
    onFileSelect(path);
  };

  // The file currently being previewed in the split panel (PDF or Mol)
  const previewFile = viewingPdf || viewingMol;
  const previewFileName = previewFile ? getFileName(previewFile) : "";
  const closePreview = () => {
    setViewingPdf(null);
    setViewingMol(null);
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b p-2 overflow-x-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowUpload(true)}
          title={t("upload")}
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setNewName("");
            setShowNewFile(true);
          }}
          title={t("newFile")}
        >
          <FilePlus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setNewName("");
            setShowNewFolder(true);
          }}
          title={t("newFolder")}
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          title={tWorkspace("sync")}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        </Button>
        {isGitRepo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePull}
            disabled={pulling}
            title={tGit("pull")}
          >
            <GitPullRequest className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* File Tree + Preview Split */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup
          orientation="vertical"
          key={previewFile ? "with-preview" : "no-preview"}
        >
          {/* File Tree Panel */}
          <ResizablePanel
            defaultSize={previewFile ? 40 : 100}
            minSize={20}
          >
            <ScrollArea className="h-full">
              <FileTree
                key={refreshKey}
                rootPath={folderPath}
                onFileOpen={handleFileOpen}
                onRefresh={refresh}
                selectedPath={selectedFilePath}
              />
            </ScrollArea>
          </ResizablePanel>

          {/* Preview Panel (PDF / Mol viewer) */}
          {previewFile && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={60} minSize={20}>
                <div className="flex h-full flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b px-3 py-1.5">
                    <span className="truncate text-sm font-medium">
                      {previewFileName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={closePreview}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {viewingPdf && <PdfViewer filePath={viewingPdf} />}
                    {viewingMol && <MolViewer filePath={viewingMol} />}
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("upload")}</DialogTitle>
          </DialogHeader>
          <UploadZone
            targetDir={folderPath}
            onUploadComplete={() => {
              setShowUpload(false);
              refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={showNewFile} onOpenChange={setShowNewFile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newFile")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("fileName")}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="example.txt"
                onKeyDown={(e) => e.key === "Enter" && handleNewFile()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewFile(false)}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleNewFile} disabled={!newName}>
                {tCommon("create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newFolder")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("folderName")}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="new-folder"
                onKeyDown={(e) => e.key === "Enter" && handleNewFolder()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNewFolder(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleNewFolder} disabled={!newName}>
                {tCommon("create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Editor Sheet (kept as sheet since it needs full-width editing) */}
      <Sheet open={!!editingFile} onOpenChange={() => setEditingFile(null)}>
        <SheetContent side="bottom" className="h-[70vh]">
          <SheetHeader>
            <SheetTitle>
              {editingFile ? getFileName(editingFile) : ""}
            </SheetTitle>
          </SheetHeader>
          {editingFile && (
            <FileEditor
              filePath={editingFile}
              onSaved={() => {
                refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
