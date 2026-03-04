"use client";

import { useTranslations } from "next-intl";
import { DatasetCard } from "./dataset-card";
import type { HfDataset, HfDownloadProgress } from "@/types";

interface DatasetListProps {
  datasets: HfDataset[];
  progressMap: Record<string, HfDownloadProgress>;
  onPreview: (dataset: HfDataset) => void;
  onDelete: (dataset: HfDataset) => void;
  onCancel: (dataset: HfDataset) => void;
  onRetry: (dataset: HfDataset) => void;
}

export function DatasetList({
  datasets,
  progressMap,
  onPreview,
  onDelete,
  onCancel,
  onRetry,
}: DatasetListProps) {
  const t = useTranslations("datasets");

  if (datasets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">{t("emptyState")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {datasets.map((dataset) => (
        <DatasetCard
          key={dataset.id}
          dataset={dataset}
          liveProgress={progressMap[dataset.id] || null}
          onPreview={onPreview}
          onDelete={onDelete}
          onCancel={onCancel}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
