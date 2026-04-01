"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  FolderIcon,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
} from "lucide-react";
import type { FileEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  filterWorkspaceImageEntries,
  getWorkspaceImageDisplayPath,
} from "./workspace-image-picker-utils";
import type { DialogContentProps } from "@radix-ui/react-dialog";

interface WorkspaceImagePickerDialogProps {
  open: boolean;
  workspaceRoot: string;
  onClose: () => void;
  onSelect: (filePath: string) => void;
  onCloseAutoFocus?: DialogContentProps["onCloseAutoFocus"];
}

export function WorkspaceImagePickerDialog({
  open,
  workspaceRoot,
  onClose,
  onSelect,
  onCloseAutoFocus,
}: WorkspaceImagePickerDialogProps) {
  const t = useTranslations("agent");
  const tCommon = useTranslations("common");
  const [currentPath, setCurrentPath] = useState(workspaceRoot);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImagePath, setSelectedImagePath] = useState<string | null>(null);

  const browsePath = useCallback(async (path: string) => {
    setIsLoading(true);
    setSelectedImagePath(null);
    try {
      const res = await fetch(`/api/files/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        throw new Error("Failed to browse workspace images");
      }

      const data: FileEntry[] = await res.json();
      setEntries(filterWorkspaceImageEntries(data));
      setCurrentPath(path);
    } catch {
      toast.error(t("workspaceImageBrowseFailed"));
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setSelectedImagePath(null);
    void browsePath(workspaceRoot);
  }, [open, workspaceRoot, browsePath]);

  const handleGoUp = () => {
    if (currentPath === workspaceRoot) return;
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
    void browsePath(parentPath || workspaceRoot);
  };

  const displayPath = getWorkspaceImageDisplayPath(workspaceRoot, currentPath);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="max-w-lg h-[65vh] flex flex-col p-0 gap-0"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-sm font-semibold">
            {t("workspaceImagePickerTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-2 border-b bg-muted/30 text-xs text-muted-foreground">
          {displayPath}
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {currentPath !== workspaceRoot ? (
                <button
                  type="button"
                  onClick={handleGoUp}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <FolderIcon className="h-4 w-4 shrink-0" />
                  ..
                </button>
              ) : null}

              {entries.map((entry) =>
                entry.type === "directory" ? (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => void browsePath(entry.path)}
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <FolderIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{entry.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                  </button>
                ) : (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => setSelectedImagePath(entry.path)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-2 text-sm transition-colors ${
                      selectedImagePath === entry.path
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <ImageIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{entry.name}</span>
                  </button>
                )
              )}

              {entries.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {t("workspaceImagePickerEmpty")}
                </p>
              ) : null}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-4 py-3 border-t shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!selectedImagePath}
            onClick={() => {
              if (!selectedImagePath) return;
              onSelect(selectedImagePath);
            }}
          >
            <ImagePlus className="h-3.5 w-3.5 mr-1" />
            {t("workspaceImagePickerAttach")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
