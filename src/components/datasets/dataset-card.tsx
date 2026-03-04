"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Eye, Trash2, RotateCcw, X, Database, Box, AppWindow } from "lucide-react";
import type { HfDataset, HfDownloadProgress } from "@/types";

interface DatasetCardProps {
  dataset: HfDataset;
  liveProgress?: HfDownloadProgress | null;
  onPreview: (dataset: HfDataset) => void;
  onDelete: (dataset: HfDataset) => void;
  onCancel: (dataset: HfDataset) => void;
  onRetry: (dataset: HfDataset) => void;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getRepoTypeIcon(repoType: string) {
  switch (repoType) {
    case "model": return <Box className="h-3.5 w-3.5" />;
    case "space": return <AppWindow className="h-3.5 w-3.5" />;
    default: return <Database className="h-3.5 w-3.5" />;
  }
}

export function DatasetCard({
  dataset,
  liveProgress,
  onPreview,
  onDelete,
  onCancel,
  onRetry,
}: DatasetCardProps) {
  const t = useTranslations("datasets");

  const isActive = dataset.status === "downloading" || dataset.status === "pending";
  const progress = liveProgress?.progress ?? dataset.progress;
  const phase = liveProgress?.phase;

  const statusVariant = {
    pending: "secondary" as const,
    downloading: "default" as const,
    ready: "default" as const,
    failed: "destructive" as const,
    cancelled: "secondary" as const,
  }[dataset.status];

  const statusLabel = {
    pending: t("statusPending"),
    downloading: t("statusDownloading"),
    ready: t("statusReady"),
    failed: t("statusFailed"),
    cancelled: t("statusCancelled"),
  }[dataset.status];

  const phaseLabel = phase ? {
    downloading: t("phaseDownloading"),
    building_manifest: t("phaseManifest"),
    computing_stats: t("phaseStats"),
    done: t("phaseDone"),
  }[phase] : null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{dataset.name}</h3>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {getRepoTypeIcon(dataset.repoType)}
              {dataset.repoId}
            </span>
          </div>
        </div>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>

      {/* Progress bar for active downloads */}
      {isActive && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{phaseLabel || t("statusDownloading")}</span>
            <span>{progress}%</span>
          </div>
          {liveProgress && liveProgress.totalBytes > 0 && (
            <div className="text-xs text-muted-foreground">
              {formatBytes(liveProgress.downloadedBytes)} / {formatBytes(liveProgress.totalBytes)}
              {" · "}
              {liveProgress.downloadedFiles} / {liveProgress.totalFiles} {t("files")}
            </div>
          )}
        </div>
      )}

      {/* Info row for completed datasets */}
      {dataset.status === "ready" && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {dataset.sizeBytes && <span>{formatBytes(dataset.sizeBytes)}</span>}
          {dataset.numFiles && <span>{dataset.numFiles} {t("files")}</span>}
          {dataset.stats && (
            <span>
              {Object.keys((dataset.stats as { splits: Record<string, unknown> }).splits || {})
                .filter((s) => s !== "default")
                .join(", ")}
            </span>
          )}
          {dataset.lastSyncAt && (
            <span>{t("lastDownloaded")}: {new Date(dataset.lastSyncAt).toLocaleDateString()}</span>
          )}
        </div>
      )}

      {/* Error message */}
      {dataset.status === "failed" && dataset.lastError && (
        <p className="text-xs text-destructive truncate" title={dataset.lastError}>
          {dataset.lastError}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1">
        {dataset.status === "ready" && (
          <Button variant="ghost" size="sm" onClick={() => onPreview(dataset)}>
            <Eye className="h-4 w-4 mr-1" />
            {t("preview")}
          </Button>
        )}
        {(dataset.status === "failed" || dataset.status === "cancelled") && (
          <Button variant="ghost" size="sm" onClick={() => onRetry(dataset)}>
            <RotateCcw className="h-4 w-4 mr-1" />
            {t("retry")}
          </Button>
        )}
        {isActive && (
          <Button variant="ghost" size="sm" onClick={() => onCancel(dataset)}>
            <X className="h-4 w-4 mr-1" />
            {t("cancelDownload")}
          </Button>
        )}
        {!isActive && (
          <Button variant="ghost" size="sm" onClick={() => onDelete(dataset)}>
            <Trash2 className="h-4 w-4 mr-1" />
            {t("deleteDataset")}
          </Button>
        )}
      </div>
    </div>
  );
}
