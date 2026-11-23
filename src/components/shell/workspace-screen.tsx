"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { AgentPanel } from "@/components/agent/agent-panel";
import { DeepResearchPanel } from "@/components/deep-research/deep-research-panel";
import { FilePreviewPanel } from "@/components/preview/file-preview-panel";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import { useAgentSessions } from "@/lib/hooks/use-agent-sessions";
import { useDeepResearchSessions } from "@/lib/hooks/use-deep-research";
import {
  buildWorkspaceHref,
  closePreview,
  openPreview,
  parseShellSurface,
  researchFocusOf,
  surfaceFromResearchFocus,
  type ResearchFocus,
  type ShellSurface,
  type ShellView,
} from "@/lib/shell/surface";
import type { Workspace } from "@/types";
import { LibraryView } from "./library-view";
import { SettingsView } from "./settings-view";
import { SkillsView } from "./skills-view";
import { WorkspaceRail } from "./workspace-rail";

interface WorkspaceScreenProps {
  workspace: Workspace;
  workspaceRoots: string[];
}

export function WorkspaceScreen({ workspace, workspaceRoots }: WorkspaceScreenProps) {
  const t = useTranslations("shell");
  const router = useRouter();
  const searchParams = useSearchParams();
  const surface = useMemo(() => parseShellSurface(searchParams), [searchParams]);
  const { workspaces } = useWorkspaces();
  const { sessions, activeSessionId, setActiveSessionId, createSession, closeSession, renameSession } = useAgentSessions(workspace.id);
  const { sessions: researchSessions } = useDeepResearchSessions(workspace.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [seedInput, setSeedInput] = useState<string | null>(null);
  const consumeSeed = useCallback(() => setSeedInput(null), []);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];

  const go = (next: ShellSurface) => {
    router.replace(buildWorkspaceHref(workspace.id, next), { scroll: false });
  };

  const showView = (view: ShellView) => {
    go({ ...surface, view, previewPath: view === "agent" ? surface.previewPath : null });
  };

  const focus = researchFocusOf(surface);

  return (
    <div className={`grid h-screen min-h-0 bg-white text-[#1e1e1c] ${surface.previewPath ? "lg:grid-cols-[210px_minmax(0,1fr)_minmax(280px,404px)]" : "lg:grid-cols-[210px_minmax(0,1fr)]"} grid-cols-[210px_minmax(0,1fr)]`}>
      <WorkspaceRail
        workspaces={workspaces}
        current={workspace}
        sessions={sessions}
        activeSessionId={activeSession?.id ?? ""}
        researchSessions={researchSessions}
        activeResearchId={surface.researchSessionId}
        researchActive={surface.view === "research"}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onBrand={() => router.push("/")}
        onSelectWorkspace={(workspaceId) => router.push(`/workspace/${workspaceId}`)}
        onCreateWorkspace={() => { setMenuOpen(false); setCreateOpen(true); }}
        onSelectSession={(sessionId) => {
          setActiveSessionId(sessionId);
          go({ ...surface, view: "agent", previewPath: null });
        }}
        onRenameSession={(session) => {
          const name = window.prompt(t("renamePrompt"), session.name);
          if (!name?.trim()) return;
          renameSession(session.id, name.trim());
          toast.success(t("renamed"));
        }}
        onDeleteSession={(session) => {
          if (sessions.length <= 1) {
            toast.error(t("keepOneSession"));
            return;
          }
          if (!confirm(t("deleteSession", { name: session.name }))) return;
          closeSession(session.id);
          go(closePreview({ ...surface, view: "agent" }));
          toast.success(t("deleted"));
        }}
        onCreateSession={() => {
          const created = createSession();
          setActiveSessionId(created.id);
          go({ ...surface, view: "agent", previewPath: null });
          toast.success(t("sessionCreated"));
        }}
        onSelectResearch={(sessionId) => go(surfaceFromResearchFocus(surface, { sessionId, intake: false }))}
        onCreateResearch={() => go(surfaceFromResearchFocus(surface, { sessionId: null, intake: true }))}
        onOpenSettings={() => showView("settings")}
        settingsActive={surface.view === "settings"}
      />

      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#e7e7e8] px-6">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold">
              {surface.view === "agent" && (activeSession?.name ?? t("agentGroup"))}
              {surface.view === "research" && (researchSessions.find((item) => item.id === surface.researchSessionId)?.title ?? t("researchGroup"))}
              {surface.view === "skills" && t("skillsTitle")}
              {surface.view === "library" && t("libraryTitle")}
              {surface.view === "settings" && t("settings")}
            </div>
            {surface.view === "agent" && activeSession && (
              <div className="truncate text-[11px] text-[#b5b5ad]">{workspace.name} / {activeSession.name}</div>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => showView("skills")} className={`rounded-full px-3 py-1 text-[13px] ${surface.view === "skills" ? "bg-white shadow-sm ring-1 ring-[#e4e4e7]" : "bg-[#f4f4f5]"}`}>{t("skillsTitle")}</button>
            <button type="button" onClick={() => showView("library")} className={`rounded-full px-3 py-1 text-[13px] ${surface.view === "library" ? "bg-white shadow-sm ring-1 ring-[#e4e4e7]" : "bg-[#f4f4f5]"}`}>{t("libraryTitle")}</button>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {surface.view === "agent" && activeSession && (
            <AgentPanel
              presentation="shell"
              workspaceId={workspace.id}
              workspaceName={workspace.name}
              folderPath={workspace.folderPath}
              sessionId={activeSession.id}
              sessionName={activeSession.name}
              sessionCreatedAt={activeSession.createdAt}
              seedInput={seedInput}
              onSeedInputConsumed={consumeSeed}
              onOpenFile={(path) => go(openPreview(surface, path))}
              onNewSession={() => {
                const created = createSession();
                setActiveSessionId(created.id);
                go({ ...surface, view: "agent", previewPath: null });
              }}
            />
          )}
          {surface.view === "skills" && <SkillsView workspaceId={workspace.id} />}
          {surface.view === "library" && (
            <LibraryView onInsertCitation={(text) => {
              setSeedInput(text);
              go({ ...surface, view: "agent", previewPath: null });
            }} />
          )}
          {surface.view === "research" && (
            <DeepResearchPanel
              workspaceId={workspace.id}
              focus={focus}
              onFocusChange={(next: ResearchFocus) => go(surfaceFromResearchFocus(surface, next))}
            />
          )}
          {surface.view === "settings" && <SettingsView />}
        </div>
      </section>

      {surface.previewPath && (
        <aside className="fixed inset-y-0 right-0 z-40 w-[min(100%,24rem)] border-l border-[#e7e7e8] bg-[#FBFAF8] shadow-xl lg:static lg:z-auto lg:w-auto lg:shadow-none">
          <FilePreviewPanel filePath={surface.previewPath} onClose={() => go(closePreview(surface))} />
        </aside>
      )}

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} workspaceRoots={workspaceRoots} defaultBrowsePath={workspaceRoots[0]} />
    </div>
  );
}
