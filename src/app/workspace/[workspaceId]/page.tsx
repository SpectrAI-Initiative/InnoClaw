"use client";

import { use, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PreviewTabs } from "@/components/preview/preview-tabs";
import { Header } from "@/components/layout/header";
import { FileBrowser } from "@/components/files/file-browser";
import { AgentPanel } from "@/components/agent/agent-panel";
import { AgentSessionTabs } from "@/components/agent/agent-session-tabs";
import { PaperStudyPanel } from "@/components/paper-study/paper-study-panel";
import { ArticlePreview } from "@/components/paper-study/article-preview";
import { NotesPanel } from "@/components/notes/notes-panel";
import { FilePreviewPanel } from "@/components/preview/file-preview-panel";
import { useWorkspace } from "@/lib/hooks/use-workspaces";
import { useMinimalMode } from "@/lib/hooks/use-minimal-mode";
import { useAgentSessions } from "@/lib/hooks/use-agent-sessions";
import { usePreviewTabs } from "@/lib/hooks/use-preview-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Bot, FileText, GraduationCap, Server, FlaskConical, Microscope, Maximize2, Loader2 } from "lucide-react";
import { ClusterPanel } from "@/components/cluster/cluster-panel";
import { ResearchExecPanel } from "@/components/research-exec/research-exec-panel";
import { DeepResearchPanel } from "@/components/deep-research/deep-research-panel";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";

type MiddlePanel = "agent" | "report" | "paperStudy" | "cluster" | "research" | "deepResearch";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const { workspace, isLoading } = useWorkspace(workspaceId);
  const [middlePanel, setMiddlePanel] = useState<MiddlePanel>("agent");
  const {
    previewTabs,
    activeTabId,
    setActiveTabId,
    openFileTab,
    openArticleTab,
    closeTab,
  } = usePreviewTabs(workspaceId);
  const { isMinimal, toggleMinimalMode } = useMinimalMode();
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    closeSession,
    renameSession,
  } = useAgentSessions(workspaceId);
  const t = useTranslations("report");
  const tc = useTranslations("cluster");
  const tRex = useTranslations("researchExec");
  const tCommon = useTranslations("common");
  const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({});
  const [extractingArticle, setExtractingArticle] = useState(false);

  const handleSessionLoadingChange = useCallback((sessionId: string, loading: boolean) => {
    setLoadingSessions((prev) => ({ ...prev, [sessionId]: loading }));
  }, []);

  const handleFileToArticle = useCallback(async (filePath: string) => {
    setExtractingArticle(true);
    try {
      const res = await fetch("/api/files/extract-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Extraction failed");
      }
      const article = await res.json();
      openArticleTab(article);
    } catch (err) {
      console.error("Extract article error:", err);
    } finally {
      setExtractingArticle(false);
    }
  }, [openArticleTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
          <p className="text-muted-foreground">Workspace not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal mode: floating toolbar */}
      {isMinimal && (
        <nav className="fixed top-3 right-3 z-50 flex items-center gap-1" aria-label={tCommon("exitMinimalMode")}>
          <LanguageToggle />
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={toggleMinimalMode}
            title={tCommon("exitMinimalMode")}
          >
            <Maximize2 className="h-4 w-4" />
            <span className="sr-only">{tCommon("exitMinimalMode")}</span>
          </Button>
        </nav>
      )}

      {/* Normal mode: header */}
      {!isMinimal && (
        <Header showMinimalToggle onToggleMinimalMode={toggleMinimalMode} />
      )}

      {/* Layout wrapper — collapsed to h-0 in minimal mode to hide panels,
          but stays mounted so all component state (including AgentPanel's useChat) is preserved.
          The AgentPanel escapes via position:fixed when in minimal mode. */}
      <div
        className={isMinimal ? "h-0 overflow-hidden" : "h-[calc(100vh-3.5rem)] overflow-hidden"}
        aria-hidden={isMinimal}
        inert={isMinimal ? true : undefined}
      >
        <ResizablePanelGroup orientation="horizontal">
          {/* Left: FileBrowser */}
          <ResizablePanel defaultSize={25} minSize={10} className="overflow-hidden">
            <FileBrowser
              workspaceId={workspaceId}
              folderPath={workspace.folderPath}
              isGitRepo={workspace.isGitRepo}
              onFileSelect={openFileTab}
              selectedFilePath={null}
              onDiscussFile={(path) => handleFileToArticle(path)}
              onIdeateFile={(path) => handleFileToArticle(path)}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Agent/Report/PaperStudy + Preview/Notes horizontal split */}
          <ResizablePanel defaultSize={75} minSize={30} className="overflow-hidden">
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize={60} minSize={10} className="overflow-hidden">
                <div className="relative h-full flex flex-col">
                  {/* Top bar: agent tabs (when active) + panel toggle buttons */}
                  {!isMinimal && (
                    <div className="flex items-center border-b border-border/50 bg-muted/30 shrink-0">
                      {/* Agent session tabs — only shown when agent panel is active */}
                      {middlePanel === "agent" && (
                        <AgentSessionTabs
                          sessions={sessions}
                          activeSessionId={activeSessionId}
                          loadingSessions={loadingSessions}
                          onSelect={setActiveSessionId}
                          onClose={closeSession}
                          onCreate={createSession}
                          onRename={renameSession}
                        />
                      )}
                      {/* Spacer when agent tabs are not shown */}
                      {middlePanel !== "agent" && <div className="flex-1" />}
                      {/* Panel toggle buttons */}
                      <div className="shrink-0 flex gap-1 bg-background/90 backdrop-blur-md rounded-lg p-1 border border-border/50 shadow-lg m-0.5 mr-1">
                        <Button
                          variant={middlePanel === "agent" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setMiddlePanel("agent")}
                          title={t("agentToggle")}
                          aria-label={t("agentToggle")}
                          className="h-7 px-2 gap-1"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          <span className="text-xs hidden lg:inline">Agent</span>
                        </Button>
                        <Button
                          variant={middlePanel === "paperStudy" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setMiddlePanel("paperStudy")}
                          title={t("paperStudyToggle")}
                          aria-label={t("paperStudyToggle")}
                          className="h-7 px-2 gap-1"
                        >
                          <GraduationCap className="h-3.5 w-3.5" />
                          <span className="text-xs hidden lg:inline">Paper</span>
                        </Button>
                        <Button
                          variant={middlePanel === "cluster" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setMiddlePanel("cluster")}
                          title={tc("clusterToggle")}
                          aria-label={tc("clusterToggle")}
                          className="h-7 px-2 gap-1"
                        >
                          <Server className="h-3.5 w-3.5" />
                          <span className="text-xs hidden lg:inline">Cluster</span>
                        </Button>
                        <Button
                          variant={middlePanel === "research" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setMiddlePanel("research")}
                          title={tRex("panelToggle")}
                          aria-label={tRex("panelToggle")}
                          className="h-7 px-2 gap-1"
                        >
                          <FlaskConical className="h-3.5 w-3.5" />
                          <span className="text-xs hidden lg:inline">Research</span>
                        </Button>
                        <Button
                          variant={middlePanel === "deepResearch" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setMiddlePanel("deepResearch")}
                          title="Deep Research"
                          aria-label="Deep Research"
                          className="h-7 px-2 gap-1"
                        >
                          <Microscope className="h-3.5 w-3.5" />
                          <span className="text-xs hidden lg:inline">Deep Research</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* AgentPanel — multi-session via tabs, each panel stays mounted.
                      In minimal mode the wrapper becomes a fixed full-screen overlay;
                      in normal mode it sits inside the panel layout as before. */}
                  <div className={
                    isMinimal
                      ? "fixed inset-0 z-40 bg-background"
                      : (middlePanel === "agent" ? "flex-1 min-h-0 flex flex-col" : "hidden")
                  }>
                    <div className={isMinimal ? "mx-auto h-screen w-full max-w-4xl flex flex-col" : "h-full flex flex-col"}>
                      {/* In minimal mode, show tabs inside the overlay */}
                      {isMinimal && (
                        <div className="border-b border-border/50 bg-muted/30 shrink-0">
                          <AgentSessionTabs
                            sessions={sessions}
                            activeSessionId={activeSessionId}
                            loadingSessions={loadingSessions}
                            onSelect={setActiveSessionId}
                            onClose={closeSession}
                            onCreate={createSession}
                            onRename={renameSession}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-h-0 relative">
                        {sessions.map((session) => (
                          <div
                            key={session.id}
                            className={session.id === activeSessionId ? "h-full" : "hidden"}
                          >
                            <AgentPanel
                              workspaceId={workspaceId}
                              workspaceName={workspace.name}
                              folderPath={workspace.folderPath}
                              sessionId={session.id}
                              sessionName={session.name}
                              sessionCreatedAt={session.createdAt}
                              onLoadingChange={(loading) => handleSessionLoadingChange(session.id, loading)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={middlePanel === "paperStudy" ? "flex-1 min-h-0" : "hidden"}>
                    <PaperStudyPanel
                      workspaceId={workspaceId}
                      onArticleSelect={(a) => { if (a) openArticleTab(a); }}
                    />
                  </div>
                  <div className={middlePanel === "cluster" ? "flex-1 min-h-0" : "hidden"}>
                    <ClusterPanel workspaceId={workspaceId} />
                  </div>
                  <div className={middlePanel === "research" ? "flex-1 min-h-0" : "hidden"}>
                    <ResearchExecPanel workspaceId={workspaceId} />
                  </div>
                  <div className={middlePanel === "deepResearch" ? "flex-1 min-h-0" : "hidden"}>
                    <DeepResearchPanel workspaceId={workspaceId} />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={40} minSize={10} className="overflow-hidden">
                <div className="flex h-full flex-col">
                  <PreviewTabs
                    tabs={previewTabs}
                    activeTabId={activeTabId}
                    onSelect={setActiveTabId}
                    onClose={closeTab}
                  />
                  <div className="flex-1 overflow-hidden relative">
                    {/* Notes panel — always mounted */}
                    <div className={activeTabId === "notes" ? "h-full" : "hidden"}>
                      <NotesPanel workspaceId={workspaceId} />
                    </div>
                    {/* Extracting article spinner */}
                    {extractingArticle && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {/* Dynamic tabs — each stays mounted */}
                    {previewTabs.map((tab) => (
                      <div key={tab.id} className={tab.id === activeTabId ? "h-full" : "hidden"}>
                        {tab.type === "file" && tab.filePath && (
                          <FilePreviewPanel
                            filePath={tab.filePath}
                            onClose={() => closeTab(tab.id)}
                            onStudyPaper={handleFileToArticle}
                          />
                        )}
                        {tab.type === "article" && tab.article && (
                          <ArticlePreview
                            article={tab.article}
                            workspaceId={workspaceId}
                            onClose={() => closeTab(tab.id)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
