"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ExternalLink } from "lucide-react";
import type { ReportSource } from "@/types/report";

interface SourcesListProps {
  sources: ReportSource[];
}

export function SourcesList({ sources }: SourcesListProps) {
  const t = useTranslations("report");

  if (sources.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">{t("noSourcesFound")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 px-6 py-4">
        {sources.map((source, idx) => (
          <div
            key={source.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {source.url ? (
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline truncate"
                  >
                    {source.title}
                  </a>
                ) : (
                  <span className="text-sm font-medium truncate">
                    {source.title}
                  </span>
                )}
              </div>
              {source.snippet && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {source.snippet}
                </p>
              )}
              {source.fileName && !source.url && (
                <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                  {source.fileName}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
