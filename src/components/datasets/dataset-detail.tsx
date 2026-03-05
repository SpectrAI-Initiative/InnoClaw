"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import type { HfDataset, HfDatasetManifest } from "@/types";

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
  const splits = manifest ? Object.keys(manifest.splits) : [];

  const [selectedSplit, setSelectedSplit] = useState(splits[0] || "default");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadPreview = useCallback(async (split: string) => {
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
  }, [dataset.id]);

  useEffect(() => {
    if (dataset.status !== "ready") return;
    loadPreview(selectedSplit);
  }, [dataset.id, selectedSplit, dataset.status, loadPreview]);

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
        {dataset.source && (
          <Badge variant="outline">
            {dataset.source === "huggingface" ? "HuggingFace" : dataset.source === "modelscope" ? "ModelScope" : t("sourceLocal")}
          </Badge>
        )}
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

      {/* Workspace Links */}
      {dataset.status === "ready" && (
        <WorkspaceLinksSection datasetId={dataset.id} />
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

interface LinkedWorkspace {
  linkId: string;
  workspaceId: string;
  workspaceName: string;
  folderPath: string;
  linkedAt: string;
}

function WorkspaceLinksSection({ datasetId }: { datasetId: string }) {
  const t = useTranslations("datasets");
  const [linkedWorkspaces, setLinkedWorkspaces] = useState<LinkedWorkspace[]>([]);
  const [allWorkspaces, setAllWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [selectedWsId, setSelectedWsId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [linkedRes, allRes] = await Promise.all([
          fetch(`/api/datasets/${datasetId}/workspaces`),
          fetch("/api/workspaces"),
        ]);
        if (cancelled) return;
        if (linkedRes.ok) setLinkedWorkspaces(await linkedRes.json());
        if (allRes.ok) {
          const data = await allRes.json();
          setAllWorkspaces(Array.isArray(data) ? data : []);
        }
      } catch (err) { console.warn("Failed to load workspace data:", err); }
    }

    load();
    return () => { cancelled = true; };
  }, [datasetId, refreshKey]);

  const handleLink = async () => {
    if (!selectedWsId) return;
    try {
      const res = await fetch(`/api/datasets/${datasetId}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: selectedWsId }),
      });
      if (res.ok) {
        toast.success(t("linkSuccess"));
        setSelectedWsId("");
        setRefreshKey((k) => k + 1);
      }
    } catch (err) { console.warn("Failed to link workspace:", err); }
  };

  const handleUnlink = async (workspaceId: string) => {
    try {
      const res = await fetch(`/api/datasets/${datasetId}/workspaces?workspaceId=${workspaceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("unlinkSuccess"));
        setRefreshKey((k) => k + 1);
      }
    } catch (err) { console.warn("Failed to unlink workspace:", err); }
  };

  const linkedIds = new Set(linkedWorkspaces.map((lw) => lw.workspaceId));
  const availableWorkspaces = allWorkspaces.filter((ws) => !linkedIds.has(ws.id));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{t("linkedWorkspaces")}</h3>

      {linkedWorkspaces.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noLinkedWorkspaces")}</p>
      ) : (
        <div className="rounded-lg border divide-y">
          {linkedWorkspaces.map((lw) => (
            <div key={lw.linkId} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{lw.workspaceName}</span>
              <Button variant="ghost" size="sm" onClick={() => handleUnlink(lw.workspaceId)}>
                {t("unlinkWorkspace")}
              </Button>
            </div>
          ))}
        </div>
      )}

      {availableWorkspaces.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedWsId} onValueChange={setSelectedWsId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t("selectWorkspace")} />
            </SelectTrigger>
            <SelectContent>
              {availableWorkspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleLink} disabled={!selectedWsId}>
            {t("linkWorkspace")}
          </Button>
        </div>
      )}
    </div>
  );
}
