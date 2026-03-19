"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight, Folder } from "lucide-react";
import { toast } from "sonner";
import { useControlledOpen } from "@/lib/hooks/use-controlled-open";
import { useDirectoryBrowser } from "@/lib/hooks/use-directory-browser";

interface CreateWorkspaceDialogProps {
  trigger?: React.ReactNode;
  workspaceRoots: string[];
  defaultBrowsePath?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateWorkspaceDialog({
  trigger,
  workspaceRoots,
  defaultBrowsePath,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateWorkspaceDialogProps) {
  const t = useTranslations("home");
  const tFiles = useTranslations("files");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { open, setOpen } = useControlledOpen(controlledOpen, controlledOnOpenChange);
  const { manualPath, setManualPath, currentPath, entries, loading, browsePath, browse, goBack, reset } =
    useDirectoryBrowser(defaultBrowsePath);
  const [workspaceName, setWorkspaceName] = useState("");

  const handleCreate = async () => {
    if (!currentPath || !workspaceName) return;
    const newFolderPath = `${currentPath}/${workspaceName}`;
    try {
      const mkdirRes = await fetch("/api/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newFolderPath }),
      });
      if (!mkdirRes.ok) {
        const err = await mkdirRes.json();
        throw new Error(err.error || "Failed to create directory");
      }

      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName, folderPath: newFolderPath }),
      });
      if (!res.ok) throw new Error("Failed to create workspace");
      const workspace = await res.json();
      setOpen(false);
      router.push(`/workspace/${workspace.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create workspace");
    }
  };

  const handleClose = (v: boolean) => {
    setOpen(v);
    if (!v) {
      reset();
      setWorkspaceName("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newWorkspace")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Step 1: Select parent path via input or root shortcuts */}
          {!currentPath && (
            <>
              <div className="space-y-2">
                <Label>{t("newWorkspaceLocation")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={manualPath}
                    onChange={(e) => setManualPath(e.target.value)}
                    placeholder={tFiles("enterPathPlaceholder")}
                    onKeyDown={(e) => { if (e.key === "Enter") browse(); }}
                  />
                  <Button onClick={browse}>{tFiles("browse")}</Button>
                </div>
              </div>

              {workspaceRoots.length > 0 && (
                <div className="space-y-2">
                  <Label>{tFiles("rootPaths")}</Label>
                  <div className="space-y-1">
                    {workspaceRoots.map((root) => (
                      <button
                        key={root}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => browsePath(root)}
                      >
                        <Folder className="h-4 w-4" />
                        <span className="truncate">{root}</span>
                        <ChevronRight className="ml-auto h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2: Browse subdirectories, name and create */}
          {currentPath && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <button className="hover:underline" onClick={goBack}>
                  {tFiles("rootPaths")}
                </button>
                <ChevronRight className="h-3 w-3" />
                <span className="truncate">{currentPath}</span>
              </div>

              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {loading ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{tCommon("loading")}</p>
                ) : entries.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{tFiles("emptyFolder")}</p>
                ) : (
                  entries.map((entry) => (
                    <button
                      key={entry.path}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => browsePath(entry.path)}
                    >
                      <Folder className="h-4 w-4" />
                      <span className="truncate">{entry.name}</span>
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("newWorkspaceName")}</Label>
                <Input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder={t("newWorkspaceName")}
                />
                {workspaceName && (
                  <p className="text-xs text-muted-foreground">{currentPath}/{workspaceName}</p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={goBack}>{tCommon("back")}</Button>
                <Button onClick={handleCreate} disabled={!workspaceName}>{tCommon("create")}</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
