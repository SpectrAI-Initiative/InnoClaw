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
import { toast } from "sonner";

interface CloneRepoDialogProps {
  trigger: React.ReactNode;
}

export function CloneRepoDialog({ trigger }: CloneRepoDialogProps) {
  const t = useTranslations("git");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [targetFolder, setTargetFolder] = useState("");
  const [cloning, setCloning] = useState(false);

  // Auto-derive target folder name from URL
  const handleUrlChange = (url: string) => {
    setRepoUrl(url);
    const name = url
      .replace(/\.git$/, "")
      .split("/")
      .pop();
    if (name) setTargetFolder(name);
  };

  const handleClone = async () => {
    if (!repoUrl) return;
    setCloning(true);
    try {
      const res = await fetch("/api/git/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          targetFolderName: targetFolder,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Clone failed");
      }

      const workspace = await res.json();
      toast.success(t("cloneSuccess"));
      setOpen(false);
      router.push(`/workspace/${workspace.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Clone failed"
      );
    } finally {
      setCloning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("clone")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("repoUrl")}</Label>
            <Input
              value={repoUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={t("repoUrlPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("targetFolder")}</Label>
            <Input
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleClone} disabled={cloning || !repoUrl}>
              {cloning ? t("cloning") : t("clone")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
