"use client";

import { use, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/header";
import { FileBrowser } from "@/components/files/file-browser";
import { AgentPanel } from "@/components/agent/agent-panel";
import { ReportPanel } from "@/components/report/report-panel";
import { NotesPanel } from "@/components/notes/notes-panel";
import { FilePreviewPanel } from "@/components/preview/file-preview-panel";
import { useWorkspace } from "@/lib/hooks/use-workspaces";
import { useReport } from "@/lib/hooks/use-report";
import { useMinimalMode } from "@/lib/hooks/use-minimal-mode";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Bot, FileText, Maximize2 } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";

type MiddlePanel = "agent" | "report";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const { workspace, isLoading } = useWorkspace(workspaceId);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [middlePanel, setMiddlePanel] = useState<MiddlePanel>("agent");
  const { report, isAvailable: reportAvailable } = useReport(workspaceId);
  const { isMinimal, toggleMinimalMode } = useMinimalMode();
  const t = useTranslations("report");
  const tCommon = useTranslations("common");

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

  if (isMinimal) {
    return (
      <div className="min-h-screen bg-background">
        {/* Floating toolbar in minimal mode */}
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
        {/* Full-screen agent panel */}
        <div className="mx-auto h-screen w-full max-w-4xl">
          <AgentPanel
            workspaceId={workspaceId}
            workspaceName={workspace.name}
            folderPath={workspace.folderPath}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header showMinimalToggle onToggleMinimalMode={toggleMinimalMode} />
      <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          {/* Left: FileBrowser */}
          <ResizablePanel defaultSize={25} minSize={10} className="overflow-hidden">
            <FileBrowser
              workspaceId={workspaceId}
              folderPath={workspace.folderPath}
              isGitRepo={workspace.isGitRepo}
              onFileSelect={setSelectedFilePath}
              selectedFilePath={selectedFilePath}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Agent/Report/PaperStudy + Preview/Notes horizontal split */}
          <ResizablePanel defaultSize={75} minSize={30} className="overflow-hidden">
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize={60} minSize={10} className="overflow-hidden">
                <div className="relative h-full">
                  {/* Panel toggle buttons - positioned above the agent panel header */}
                  <div className="absolute top-1 right-3 z-50 flex gap-1 bg-background/90 backdrop-blur-md rounded-lg p-1 border border-border/50 shadow-lg">
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
                      variant={middlePanel === "report" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setMiddlePanel("report")}
                      disabled={!reportAvailable}
                      title={t("reportToggle")}
                      aria-label={t("reportToggle")}
                      className="h-7 px-2 gap-1"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span className="text-xs hidden lg:inline">Report</span>
                    </Button>
                  </div>

                  {/* Keep all mounted for state preservation */}
                  <div className={middlePanel === "agent" ? "h-full" : "hidden"}>
                    <AgentPanel
                      workspaceId={workspaceId}
                      workspaceName={workspace.name}
                      folderPath={workspace.folderPath}
                    />
                  </div>
                  <div className={middlePanel === "report" ? "h-full" : "hidden"}>
                    <ReportPanel report={report} />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={40} minSize={10} className="overflow-hidden">
                <Tabs defaultValue="preview" className="flex h-full flex-col">
                  <TabsList className="mx-2 mt-1 shrink-0">
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
                    <FilePreviewPanel
                      filePath={selectedFilePath}
                      onClose={() => setSelectedFilePath(null)}
                    />
                  </TabsContent>
                  <TabsContent value="notes" className="flex-1 overflow-hidden mt-0">
                    <NotesPanel workspaceId={workspaceId} />
                  </TabsContent>
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
