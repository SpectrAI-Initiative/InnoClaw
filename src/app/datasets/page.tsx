"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useDatasets, useActiveProgress } from "@/lib/hooks/use-datasets";
import { DatasetList } from "@/components/datasets/dataset-list";
import { DatasetDetail } from "@/components/datasets/dataset-detail";
import { HfDownloadDialog } from "@/components/datasets/hf-download-dialog";
import type { HfDataset } from "@/types";

export default function DatasetsPage() {
  const t = useTranslations("datasets");
  const { datasets, mutate } = useDatasets();
  const progressMap = useActiveProgress(datasets);
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
                {t("newDownload")}
              </Button>
            }
            onDownloadStarted={() => mutate()}
          />
        </div>

        <DatasetList
          datasets={datasets}
          progressMap={progressMap}
          onPreview={handlePreview}
          onDelete={handleDelete}
          onCancel={handleCancel}
          onRetry={handleRetry}
        />
      </main>
    </div>
  );
}
