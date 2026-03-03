"use client";

import React, { useMemo } from "react";
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
  const content = useMemo(() => markdown, [markdown]);

  if (!content.trim()) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">No report content available.</p>
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
