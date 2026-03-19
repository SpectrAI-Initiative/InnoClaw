"use client";

import { useDeferredValue } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  markdownComponents,
  remarkPlugins,
  rehypePlugins,
} from "@/lib/markdown/shared-components";
import { useFileContent } from "@/lib/hooks/use-file-content";

export function MarkdownPreview({ filePath }: { filePath: string }) {
  const t = useTranslations("preview");
  const tCommon = useTranslations("common");

  const { content, loading, saving, modified, handleSave, updateContent } =
    useFileContent({ filePath });

  // Defer markdown rendering so typing stays responsive
  const deferredContent = useDeferredValue(content);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {tCommon("loading")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="flex items-center justify-end gap-2 border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          {saving
            ? t("autoSaving")
            : modified
              ? tCommon("modified")
              : ""}
        </span>
      </div>

      {/* Editor + Preview split */}
      <ResizablePanelGroup orientation="vertical" className="flex-1">
        <ResizablePanel defaultSize={40} minSize={15}>
          <Textarea
            className="h-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={60} minSize={15}>
          <ScrollArea className="h-full px-4 py-2">
            <div className="chat-prose">
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >
                {deferredContent}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
