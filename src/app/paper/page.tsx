"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { PaperStudyPanel } from "@/components/paper-study/paper-study-panel";
import { ArticlePreview } from "@/components/paper-study/article-preview";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { Article } from "@/lib/article-search/types";

export default function PaperPage() {
  const t = useTranslations("paperStudy");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={60} minSize={30}>
            <PaperStudyPanel
              workspaceId=""
              onArticleSelect={setSelectedArticle}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={20}>
            {selectedArticle ? (
              <ArticlePreview
                article={selectedArticle}
                workspaceId=""
                onClose={() => setSelectedArticle(null)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <p>{t("selectArticleToPreview") || "Select an article to preview"}</p>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
