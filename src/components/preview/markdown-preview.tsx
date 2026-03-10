"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Pencil, Save } from "lucide-react";
import {
  markdownComponents,
  remarkPlugins,
  rehypePlugins,
} from "@/lib/markdown/shared-components";
import { useFileContent } from "@/lib/hooks/use-file-content";
import { toast } from "sonner";

export function MarkdownPreview({ filePath }: { filePath: string }) {
  const t = useTranslations("preview");
  const tCommon = useTranslations("common");
  const tFiles = useTranslations("files");
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");

  const { content, loading, saving, modified, handleSave, updateContent } =
    useFileContent({
      filePath,
      onLoad: () => setViewMode("preview"),
    });

  const onSave = async () => {
    const ok = await handleSave();
    if (ok) toast.success(tFiles("saved"));
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {tCommon("loading")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-2 px-3 py-2">
        {modified && (
          <span className="text-xs text-muted-foreground">{tCommon("modified")}</span>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("preview")}
            title={t("previewMode")}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            {t("previewMode")}
          </Button>
          <Button
            variant={viewMode === "edit" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("edit")}
            title={t("editMode")}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {t("editMode")}
          </Button>
        </div>
        {viewMode === "edit" && (
          <Button size="sm" onClick={onSave} disabled={saving || !modified}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? tFiles("saving") : tCommon("save")}
          </Button>
        )}
      </div>
      {viewMode === "preview" ? (
        <ScrollArea className="flex-1 px-4 py-2">
          <div className="chat-prose">
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={rehypePlugins}
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
          <Textarea
            className="flex-1 resize-none font-mono text-sm"
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                onSave();
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
