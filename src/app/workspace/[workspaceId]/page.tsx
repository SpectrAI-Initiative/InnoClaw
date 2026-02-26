"use client";

import { use, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Header } from "@/components/layout/header";
import { FileBrowser } from "@/components/files/file-browser";
import { ChatPanel } from "@/components/chat/chat-panel";
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
                    <ChatPanel
                      workspaceId={workspaceId}
                      workspaceName={workspace.name}
                    />
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  <ResizablePanel defaultSize={40} minSize={10} className="overflow-hidden">
                    <FilePreviewPanel
                      filePath={selectedFilePath}
                      onClose={() => setSelectedFilePath(null)}
                    />
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
