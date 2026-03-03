"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, FileDown, FileText, Link2, Loader2 } from "lucide-react";
import { ReportContent } from "@/components/report/report-content";
import { ProcessTimeline } from "@/components/report/process-timeline";
import { SourcesList } from "@/components/report/sources-list";
import {
  downloadAsMarkdown,
  downloadAsPdf,
  copyReportContent,
} from "@/lib/report/download-utils";
import { toast } from "sonner";
import type { ReportData } from "@/types/report";

interface ReportPanelProps {
  report: ReportData | null;
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("report");
  switch (status) {
    case "completed":
      return (
        <Badge className="border-green-500/20 bg-green-500/15 text-green-700 dark:text-green-400">
          {t("statusCompleted")}
        </Badge>
      );
    case "running":
      return (
        <Badge className="border-yellow-500/20 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          {t("statusRunning")}
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">
          {t("statusError")}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          {t("statusPending")}
        </Badge>
      );
  }
}

export function ReportPanel({ report }: ReportPanelProps) {
  const t = useTranslations("report");
  const [activeTab, setActiveTab] = useState("report");

  if (!report) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center px-8">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("noReport")}
        </p>
      </div>
    );
  }

  const processCompleted = report.processSteps.every((s) => s.status === "completed");

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        {/* Left: Status badge */}
        <StatusBadge status={report.status} />

        {/* Center: Tabs */}
        <div className="flex-1 flex justify-center">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList variant="line">
              <TabsTrigger value="report" className="text-sm">
                {t("tabReport")}
              </TabsTrigger>
              <TabsTrigger value="process" className="text-sm">
                {processCompleted && <Check className="mr-1 h-3.5 w-3.5" />}
                {t("tabProcess")}
              </TabsTrigger>
              <TabsTrigger value="sources" className="text-sm">
                {t("tabSources")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadAsPdf(report)}
            title={t("downloadPdf")}
          >
            <FileDown className="mr-1 h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadAsMarkdown(report)}
            title={t("downloadMd")}
          >
            <FileDown className="mr-1 h-3.5 w-3.5" />
            Md
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const ok = await copyReportContent(report);
              if (ok) toast.success(t("linkCopied"));
            }}
            title={t("share")}
          >
            <Link2 className="mr-1 h-3.5 w-3.5" />
            {t("share")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "report" && (
          <ReportContent markdown={report.markdownContent} />
        )}
        {activeTab === "process" && (
          <ProcessTimeline steps={report.processSteps} />
        )}
        {activeTab === "sources" && (
          <SourcesList sources={report.sources} />
        )}
      </div>
    </div>
  );
}
