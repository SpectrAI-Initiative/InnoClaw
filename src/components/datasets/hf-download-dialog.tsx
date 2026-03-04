"use client";

import { useState, useCallback, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { HfRepoType, HfRepoInfo } from "@/types";

interface HfDownloadDialogProps {
  trigger: React.ReactNode;
  onDownloadStarted?: () => void;
}

export function HfDownloadDialog({ trigger, onDownloadStarted }: HfDownloadDialogProps) {
  const t = useTranslations("datasets");
  const tCommon = useTranslations("common");

  const [open, setOpen] = useState(false);
  const [repoId, setRepoId] = useState("");
  const [repoType, setRepoType] = useState<HfRepoType>("dataset");
  const [revision, setRevision] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [allowPatterns, setAllowPatterns] = useState("");
  const [ignorePatterns, setIgnorePatterns] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Repo info state
  const [repoInfo, setRepoInfo] = useState<HfRepoInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-derive display name from repoId
  const handleRepoIdChange = (value: string) => {
    setRepoId(value);
    const name = value.split("/").pop();
    if (name) setDisplayName(name);

    // Reset info
    setRepoInfo(null);
    setInfoError(null);

    // Debounce repo info fetch
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    if (value.includes("/") && value.split("/").length === 2) {
      fetchTimerRef.current = setTimeout(() => {
        fetchRepoInfo(value, repoType);
      }, 800);
    }
  };

  const handleRepoTypeChange = (value: HfRepoType) => {
    setRepoType(value);
    if (repoId.includes("/")) {
      fetchRepoInfo(repoId, value);
    }
  };

  const fetchRepoInfo = useCallback(async (id: string, type: HfRepoType) => {
    setLoadingInfo(true);
    setInfoError(null);
    try {
      const res = await fetch(`/api/datasets/repo-info?repoId=${encodeURIComponent(id)}&repoType=${type}`);
      if (!res.ok) {
        const data = await res.json();
        setInfoError(data.error || "Failed to fetch repo info");
        setRepoInfo(null);
      } else {
        const data = await res.json();
        setRepoInfo(data);
      }
    } catch {
      setInfoError("Failed to fetch repo info");
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  const handleSubmit = async () => {
    if (!repoId) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        repoId,
        repoType,
        name: displayName || repoId.split("/").pop() || repoId,
      };
      if (revision) body.revision = revision;

      const allow = allowPatterns.split(",").map((s) => s.trim()).filter(Boolean);
      const ignore = ignorePatterns.split(",").map((s) => s.trim()).filter(Boolean);
      if (allow.length > 0) body.allowPatterns = allow;
      if (ignore.length > 0) body.ignorePatterns = ignore;

      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start download");
      }

      toast.success(t("downloading"));
      setOpen(false);
      resetForm();
      onDownloadStarted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("downloadFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setRepoId("");
    setRepoType("dataset");
    setRevision("");
    setDisplayName("");
    setAllowPatterns("");
    setIgnorePatterns("");
    setShowAdvanced(false);
    setRepoInfo(null);
    setInfoError(null);
  };

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("downloadTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Repo ID */}
          <div className="space-y-2">
            <Label>{t("repoId")} *</Label>
            <Input
              value={repoId}
              onChange={(e) => handleRepoIdChange(e.target.value)}
              placeholder={t("repoIdPlaceholder")}
            />
          </div>

          {/* Repo Type */}
          <div className="space-y-2">
            <Label>{t("repoType")}</Label>
            <Select value={repoType} onValueChange={(v) => handleRepoTypeChange(v as HfRepoType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dataset">{t("repoTypeDataset")}</SelectItem>
                <SelectItem value="model">{t("repoTypeModel")}</SelectItem>
                <SelectItem value="space">{t("repoTypeSpace")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Repo Info Preview */}
          {loadingInfo && (
            <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("loadingRepoInfo")}
            </div>
          )}
          {infoError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {infoError}
            </div>
          )}
          {repoInfo && !loadingInfo && (
            <div className="rounded-md border bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium">{t("repoInfo")}</p>
              {repoInfo.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{repoInfo.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{repoInfo.totalFiles} {t("totalFiles")}</span>
                {repoInfo.totalSize && <span>{formatBytes(repoInfo.totalSize)}</span>}
                {repoInfo.lastModified && (
                  <span>{new Date(repoInfo.lastModified).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          )}

          {/* Advanced Options */}
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {t("advancedOptions")}
          </button>

          {showAdvanced && (
            <div className="space-y-3 pl-5 border-l">
              <div className="space-y-2">
                <Label>{t("revision")}</Label>
                <Input
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  placeholder={t("revisionPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("allowPatterns")}</Label>
                <Input
                  value={allowPatterns}
                  onChange={(e) => setAllowPatterns(e.target.value)}
                  placeholder={t("allowPatternsPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("ignorePatterns")}</Label>
                <Input
                  value={ignorePatterns}
                  onChange={(e) => setIgnorePatterns(e.target.value)}
                  placeholder={t("ignorePatternsPlaceholder")}
                />
              </div>
            </div>
          )}

          {/* Display Name */}
          <div className="space-y-2">
            <Label>{t("displayName")}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !repoId}>
              {submitting ? t("downloading") : t("startDownload")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
