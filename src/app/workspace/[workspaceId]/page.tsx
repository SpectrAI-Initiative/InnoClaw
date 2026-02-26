"use client";

import { use, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/header";
import { FileBrowser } from "@/components/files/file-browser";
import { AgentPanel } from "@/components/agent/agent-panel";
import { NotesPanel } from "@/components/notes/notes-panel";
import { FilePreviewPanel } from "@/components/preview/file-preview-panel";
import { TerminalPanel } from "@/components/terminal/terminal-panel";
import { useWorkspace } from "@/lib/hooks/use-workspaces";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const { workspace, isLoading } = useWorkspace(workspaceId);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

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
      <Header />
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

          {/* Right: Vertical split — Chat+Notes on top, Terminal on bottom */}
          <ResizablePanel defaultSize={75} minSize={30} className="overflow-hidden">
            <ResizablePanelGroup orientation="vertical">
              {/* Top: Chat + Notes horizontal split */}
              <ResizablePanel defaultSize={65} minSize={20} className="overflow-hidden">
                <ResizablePanelGroup orientation="horizontal">
                  <ResizablePanel defaultSize={60} minSize={10} className="overflow-hidden">
                    <AgentPanel
                      workspaceId={workspaceId}
                      workspaceName={workspace.name}
                      folderPath={workspace.folderPath}
                    />
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

              <ResizableHandle withHandle />

              {/* Bottom: Terminal */}
              <ResizablePanel defaultSize={35} minSize={10} className="overflow-hidden">
                <TerminalPanel cwd={workspace.folderPath} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
