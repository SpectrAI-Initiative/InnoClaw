"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { PaperStudyPanel } from "@/components/paper-study/paper-study-panel";
import { ArticlePreview } from "@/components/paper-study/article-preview";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { usePaperNotesDir } from "@/lib/hooks/use-paper-notes-dir";
import type { Article } from "@/lib/article-search/types";

export default function PaperPage() {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const { notesDir, setNotesDir } = usePaperNotesDir();

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={60} minSize={30}>
            <PaperStudyPanel
              workspaceId=""
              onArticleSelect={setSelectedArticle}
              notesDir={notesDir}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={20}>
            <ArticlePreview
              article={selectedArticle}
              workspaceId=""
              onClose={() => setSelectedArticle(null)}
              notesDir={notesDir}
              onSetNotesDir={setNotesDir}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
