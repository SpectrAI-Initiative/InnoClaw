"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  markdownComponents,
  remarkPlugins,
  rehypePlugins,
} from "@/lib/markdown/shared-components";

interface ReportContentProps {
  markdown: string;
}

export function ReportContent({ markdown }: ReportContentProps) {
  const t = useTranslations("report");
  const content = useMemo(() => markdown, [markdown]);

  if (!content.trim()) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">{t("noReportContent")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="report-prose">
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    </ScrollArea>
  );
}
