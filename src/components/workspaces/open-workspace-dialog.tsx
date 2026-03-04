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
import type { FileEntry } from "@/types";

interface OpenWorkspaceDialogProps {
  trigger: React.ReactNode;
  workspaceRoots: string[];
}

export function OpenWorkspaceDialog({
  trigger,
  workspaceRoots,
}: OpenWorkspaceDialogProps) {
  const t = useTranslations("files");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const browsePath = async (dirPath: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/files/browse?path=${encodeURIComponent(dirPath)}`
      );
      if (!res.ok) throw new Error("Failed to browse");
      const data = await res.json();
      setEntries(data.filter((e: FileEntry) => e.type === "directory"));
      setCurrentPath(dirPath);
      // Set default workspace name from folder name
      const folderName = dirPath.split("/").pop() || dirPath.split("\\").pop();
      if (folderName) setWorkspaceName(folderName);
    } catch {
      toast.error("Failed to browse directory");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    if (!currentPath || !workspaceName) return;

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workspaceName,
          folderPath: currentPath,
        }),
      });

      if (!res.ok) throw new Error("Failed to create workspace");
      const workspace = await res.json();
      setOpen(false);
      router.push(`/workspace/${workspace.id}`);
    } catch {
      toast.error("Failed to open workspace");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("selectFolder")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Root paths */}
          {!currentPath && (
            <div className="space-y-2">
              <Label>{t("rootPaths")}</Label>
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

          {/* Directory browser */}
          {currentPath && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <button
                  className="hover:underline"
                  onClick={() => {
                    setCurrentPath("");
                    setEntries([]);
                  }}
                >
                  {t("rootPaths")}
                </button>
                <ChevronRight className="h-3 w-3" />
                <span className="truncate">{currentPath}</span>
              </div>

              <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2">
                {loading ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {tCommon("loading")}
                  </p>
                ) : entries.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t("emptyFolder")}
                  </p>
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
                <Label>{t("folderName")}</Label>
                <Input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Workspace name"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentPath("");
                    setEntries([]);
                  }}
                >
                  {tCommon("back")}
                </Button>
                <Button onClick={handleOpen} disabled={!workspaceName}>
                  {tCommon("open")}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
