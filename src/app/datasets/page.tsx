"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Plus, ArrowDown, ArrowUp, Server } from "lucide-react";
import { toast } from "sonner";
import { useDatasets, useActiveProgress, useNetworkSpeed } from "@/lib/hooks/use-datasets";
import { DatasetList } from "@/components/datasets/dataset-list";
import { DatasetDetail } from "@/components/datasets/dataset-detail";
import { HfDownloadDialog } from "@/components/datasets/hf-download-dialog";
import type { HfDataset } from "@/types";

function formatBytesPerSecond(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}

function NetworkSpeedBar({ networkSpeed }: { networkSpeed: { rxBytesPerSecond: number; txBytesPerSecond: number } }) {
  const t = useTranslations("datasets");

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2 text-sm mb-4">
      <Server className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{t("serverNetwork")}</span>
      <div className="flex items-center gap-3 font-mono text-xs">
        <span className="flex items-center gap-1">
          <ArrowDown className="h-3 w-3 text-blue-500" />
          {formatBytesPerSecond(networkSpeed.rxBytesPerSecond)}
        </span>
        <span className="flex items-center gap-1">
          <ArrowUp className="h-3 w-3 text-green-500" />
          {formatBytesPerSecond(networkSpeed.txBytesPerSecond)}
        </span>
      </div>
    </div>
  );
}

export default function DatasetsPage() {
  const t = useTranslations("datasets");
  const { datasets, mutate } = useDatasets();
  const progressMap = useActiveProgress(datasets);
  const networkSpeed = useNetworkSpeed();
  const [selectedDataset, setSelectedDataset] = useState<HfDataset | null>(null);

  const handlePreview = (dataset: HfDataset) => {
    setSelectedDataset(dataset);
  };

  const handleBack = () => {
    setSelectedDataset(null);
  };

  const handleDelete = async (dataset: HfDataset) => {
    if (!confirm(t("deleteConfirm", { name: dataset.name }))) return;
    try {
      const res = await fetch(`/api/datasets/${dataset.id}?deleteFiles=true`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete dataset");
        return;
      }
      if (selectedDataset?.id === dataset.id) {
        setSelectedDataset(null);
      }
      mutate();
    } catch {
      toast.error("Failed to delete dataset");
    }
  };

  const handleCancel = async (dataset: HfDataset) => {
    try {
      const res = await fetch(`/api/datasets/${dataset.id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to cancel download");
        return;
      }
      toast.success(t("cancelled"));
      mutate();
    } catch {
      toast.error("Failed to cancel download");
    }
  };

  const handleRetry = async (dataset: HfDataset) => {
    try {
      const res = await fetch(`/api/datasets/${dataset.id}/retry`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to retry download");
        return;
      }
      mutate();
    } catch {
      toast.error("Failed to retry download");
    }
  };

  const handlePause = async (dataset: HfDataset) => {
    try {
      const res = await fetch(`/api/datasets/${dataset.id}/pause`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to pause download");
        return;
      }
      toast.success(t("statusPaused"));
      mutate();
    } catch {
      toast.error("Failed to pause download");
    }
  };

  const handleRefresh = async (dataset: HfDataset) => {
    try {
      const res = await fetch(`/api/datasets/${dataset.id}/refresh`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to refresh stats");
        return;
      }
      toast.success(t("refreshSuccess"));
      mutate();
    } catch {
      toast.error("Failed to refresh stats");
    }
  };

  // Show detail view if a dataset is selected
  if (selectedDataset) {
    // Find the latest version from the list
    const latest = datasets.find((d) => d.id === selectedDataset.id) || selectedDataset;
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <DatasetDetail
            dataset={latest}
            onBack={handleBack}
            onRetry={handleRetry}
            onDelete={handleDelete}
          />
        </main>
      </div>
    );
  }

  const showNetSpeed =
    networkSpeed &&
    (networkSpeed.rxBytesPerSecond > 1024 || networkSpeed.txBytesPerSecond > 1024);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <HfDownloadDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("addDataset")}
              </Button>
            }
            onDownloadStarted={() => mutate()}
          />
        </div>

        {showNetSpeed && <NetworkSpeedBar networkSpeed={networkSpeed} />}

        <DatasetList
          datasets={datasets}
          progressMap={progressMap}
          onPreview={handlePreview}
          onDelete={handleDelete}
          onCancel={handleCancel}
          onRetry={handleRetry}
          onPause={handlePause}
          onRefresh={handleRefresh}
        />
      </main>
    </div>
  );
}
