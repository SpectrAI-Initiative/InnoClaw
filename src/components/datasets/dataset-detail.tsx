"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, RotateCcw, Trash2, File } from "lucide-react";
import { DatasetPreviewTable } from "./dataset-preview-table";
import type { HfDataset, HfDatasetManifest, HfDatasetStats } from "@/types";

interface DatasetDetailProps {
  dataset: HfDataset;
  onBack: () => void;
  onRetry: (dataset: HfDataset) => void;
  onDelete: (dataset: HfDataset) => void;
}

interface PreviewData {
  split: string;
  format: string;
  totalRows: number | null;
  columns: string[];
  rows: Record<string, unknown>[];
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function DatasetDetail({ dataset, onBack, onRetry, onDelete }: DatasetDetailProps) {
  const t = useTranslations("datasets");
  const tCommon = useTranslations("common");

  const manifest = dataset.manifest as HfDatasetManifest | null;
  const stats = dataset.stats as HfDatasetStats | null;
  const splits = manifest ? Object.keys(manifest.splits) : [];

  const [selectedSplit, setSelectedSplit] = useState(splits[0] || "default");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (dataset.status !== "ready") return;
    loadPreview(selectedSplit);
  }, [dataset.id, selectedSplit, dataset.status]);

  const loadPreview = async (split: string) => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/datasets/${dataset.id}/preview?split=${encodeURIComponent(split)}&n=20`);
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      } else {
        setPreview(null);
      }
    } catch {
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Get file list from the selected split in the manifest
  const splitData = manifest?.splits[selectedSplit];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {tCommon("back")}
        </Button>
        <h2 className="text-lg font-semibold">{dataset.repoId}</h2>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Badge variant={dataset.status === "ready" ? "default" : "secondary"}>
          {t(`status${dataset.status.charAt(0).toUpperCase() + dataset.status.slice(1)}` as
            "statusPending" | "statusDownloading" | "statusReady" | "statusFailed" | "statusCancelled"
          )}
        </Badge>
        {dataset.sizeBytes && <span>{t("size")}: {formatBytes(dataset.sizeBytes)}</span>}
        {dataset.numFiles && <span>{dataset.numFiles} {t("files")}</span>}
        {dataset.localPath && <span className="font-mono text-xs">{dataset.localPath}</span>}
        {dataset.lastSyncAt && (
          <span>{t("lastDownloaded")}: {new Date(dataset.lastSyncAt).toLocaleString()}</span>
        )}
      </div>

      {/* Preview Section */}
      {dataset.status === "ready" && (
        <>
          {/* Split selector */}
          {splits.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{t("split")}:</span>
              <Select value={selectedSplit} onValueChange={setSelectedSplit}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {splits.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {preview && (
                <span className="text-xs text-muted-foreground">
                  {preview.format.toUpperCase()}
                  {preview.totalRows !== null && ` · ${preview.totalRows} ${t("rows")}`}
                </span>
              )}
            </div>
          )}

          {/* Data Table */}
          <div className="rounded-lg border">
            {loadingPreview ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                {tCommon("loading")}
              </div>
            ) : preview && preview.columns.length > 0 ? (
              <DatasetPreviewTable columns={preview.columns} rows={preview.rows} />
            ) : (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No preview data available for this split.
              </div>
            )}
          </div>
        </>
      )}

      {/* File List */}
      {splitData && splitData.files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("fileList")}</h3>
          <div className="rounded-lg border divide-y">
            {splitData.files.map((file) => (
              <div key={file.path} className="flex items-center gap-3 px-3 py-2 text-sm">
                <File className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1 font-mono text-xs">{file.path}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatBytes(file.sizeBytes)}
                </span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {file.format}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={() => onRetry(dataset)}>
          <RotateCcw className="h-4 w-4 mr-1" />
          {t("redownload")}
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(dataset)}>
          <Trash2 className="h-4 w-4 mr-1" />
          {t("deleteDataset")}
        </Button>
      </div>
    </div>
  );
}
