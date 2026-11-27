"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { seedDeepResearch } from "@/lib/demo-seed";
import { useStorageScope, scopeKey } from "@/lib/hooks/use-storage-scope";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Zap, FileText, Copy, ExternalLink, Share2, PanelRightClose, Eye, Info, ArrowLeft } from "lucide-react";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { AgentPanel } from "@/components/agent/agent-panel";
import { DeepResearchPanel } from "@/components/deep-research/deep-research-panel";
import { FilePreviewPanel } from "@/components/preview/file-preview-panel";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import { useTeams } from "@/lib/hooks/use-teams";
import { useAgentSessions } from "@/lib/hooks/use-agent-sessions";
import { useDeepResearchSessions } from "@/lib/hooks/use-deep-research";
import {
  buildWorkspaceHref, closePreview, openPreview, parseShellSurface,
  researchFocusOf, surfaceFromResearchFocus,
  type ResearchFocus, type ShellSurface, type ShellView,
} from "@/lib/shell/surface";
import type { Workspace } from "@/types";
import { LibraryView } from "./library-view";
import { SettingsView } from "./settings-view";
import { SkillsView } from "./skills-view";
import { WorkspaceRail } from "./workspace-rail";
import { TeamPanel } from "./team-panel";

interface WorkspaceScreenProps {
  workspace: Workspace;
  workspaceRoots: string[];
}

export function WorkspaceScreen({ workspace, workspaceRoots }: WorkspaceScreenProps) {
  const t = useTranslations("shell");
  const router = useRouter();
  const searchParams = useSearchParams();
  const surface = useMemo(() => parseShellSurface(searchParams), [searchParams]);
  const { workspaces, mutate: mutateWorkspaces } = useWorkspaces();
  const { teams, mutate: mutateTeams } = useTeams();
  const { scope, ready, isAuthDisabled } = useStorageScope();
  const [activeTeamId, setActiveTeamId] = useState<string | null>(() => {
    try { return localStorage.getItem("innoscale-active-team") || null; } catch { return null; }
  });
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [teamPanelTeamId, setTeamPanelTeamId] = useState<string | null>(null);
  const selectTeam = useCallback(async (id: string | null) => {
    setActiveTeamId(id);
    try {
      if (id) localStorage.setItem("innoscale-active-team", id);
      else localStorage.removeItem("innoscale-active-team");
    } catch { /* ignore */ }
    // Entering a team space opens its first shared workspace so members land
    // directly on the shared data, mirroring ClawsGo's team-space behaviour.
    if (id) {
      try {
        const res = await fetch(`/api/teams/${id}`);
        if (res.ok) {
          const detail = await res.json();
          const first = detail.workspaces?.[0];
          if (first?.id && first.id !== workspace.id) {
            router.push(`/workspace/${first.id}`);
          }
        }
      } catch { /* stay on current workspace if lookup fails */ }
    }
  }, [router, workspace.id]);
  const openTeamPanel = useCallback((id?: string | null) => {
    setTeamPanelTeamId(id ?? activeTeamId ?? null);
    setTeamPanelOpen(true);
  }, [activeTeamId]);
  const { sessions, activeSessionId, setActiveSessionId, createSession, closeSession, renameSession } = useAgentSessions(workspace.id);
  const { sessions: researchSessions, mutate: mutateResearchSessions } = useDeepResearchSessions(workspace.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [seedInput, setSeedInput] = useState<string | null>(null);
  const consumeSeed = useCallback(() => setSeedInput(null), []);

  // 旧数据迁移已提前到 useStorageScope 内同步完成（必须在会话渲染期初始化之前）。

  // 本地验证：仅单用户演示模式（未登录）灌入演示 Deep Research 会话。
  // 登录账号下不再注入演示会话，保证新账号是空的。
  useEffect(() => {
    if (isAuthDisabled && scope) void seedDeepResearch(scope, workspace.id);
  }, [isAuthDisabled, scope, workspace.id]);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];

  const go = (next: ShellSurface) => router.replace(buildWorkspaceHref(workspace.id, next), { scroll: false });
  const showView = (view: ShellView) => go({ ...surface, view, previewPath: view === "agent" ? surface.previewPath : null });
  const settingsReturnRef = useRef<ShellSurface | null>(null);
  const settingsReturnKey = scopeKey(scope ?? "anonymous", `innoscale:settings-return:${workspace.id}`);

  // 设置页来源需可跨刷新保留，否则直接打开设置页时只能回默认对话页。
  const openSettings = () => {
    settingsReturnRef.current = surface;
    try { sessionStorage.setItem(settingsReturnKey, JSON.stringify(surface)); } catch { /* 隐私模式下忽略 */ }
    router.push(buildWorkspaceHref(workspace.id, { ...surface, view: "settings", previewPath: null }), { scroll: false });
  };
  const backFromSettings = () => {
    let from = settingsReturnRef.current;
    try {
      const cached = sessionStorage.getItem(settingsReturnKey);
      if (!from && cached) from = JSON.parse(cached) as ShellSurface;
      sessionStorage.removeItem(settingsReturnKey);
    } catch { /* 缓存损坏则忽略 */ }
    settingsReturnRef.current = null;
    if (from) router.back();
    else go({ ...surface, view: "agent", previewPath: null });
  };
  const focus = researchFocusOf(surface);

  const headerTitle =
    surface.view === "agent" ? (activeSession?.name ?? t("agentGroup")) :
    surface.view === "research" ? (researchSessions.find((i) => i.id === surface.researchSessionId)?.title ?? t("researchGroup")) :
    surface.view === "skills" ? "技能库" :
    surface.view === "library" ? "文献库" :
    surface.view === "settings" ? "设置" : "";

  return (
    <div className={`app${surface.previewPath ? " cf-open" : ""}${surface.view === "settings" ? " app-settings" : ""}`}>
      <WorkspaceRail
        workspaces={workspaces}
        current={workspace}
        teams={teams}
        activeTeamId={activeTeamId}
        onSelectTeam={selectTeam}
        onManageTeam={openTeamPanel}
        onTeamsChanged={() => void mutateTeams()}
        onWorkspacesChanged={() => void mutateWorkspaces()}
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
        onRenameWorkspace={() => {
          setMenuOpen(false);
          const name = window.prompt(t("workspaceRenamePrompt"), workspace.name);
          if (!name?.trim()) return;
          void (async () => {
            try {
              const res = await fetch(`/api/workspaces/${workspace.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
              });
              if (!res.ok) throw new Error("rename failed");
              await Promise.all([mutateWorkspaces(), router.refresh()]);
              toast.success(t("renamed"));
            } catch {
              toast.error(t("renameFailed"));
            }
          })();
        }}
        onSelectSession={(sessionId) => { setActiveSessionId(sessionId); go({ ...surface, view: "agent", previewPath: null }); }}
        onRenameSession={(session) => {
          const name = window.prompt(t("renamePrompt"), session.name);
          if (!name?.trim()) return;
          renameSession(session.id, name.trim());
          toast.success(t("renamed"));
        }}
        onDeleteSession={(session) => {
          if (sessions.length <= 1) { toast.error(t("keepOneSession")); return; }
          if (!confirm(t("deleteSession", { name: session.name }))) return;
          closeSession(session.id);
          go(closePreview({ ...surface, view: "agent" }));
          toast.success(t("deleted"));
        }}
        onCreateSession={() => { const created = createSession(); setActiveSessionId(created.id); go({ ...surface, view: "agent", previewPath: null }); toast.success(t("sessionCreated")); }}
        onSelectResearch={(sessionId) => go(surfaceFromResearchFocus(surface, { sessionId, intake: false }))}
        onCreateResearch={() => go(surfaceFromResearchFocus(surface, { sessionId: null, intake: true }))}
        onRenameResearch={(session) => {
          const title = window.prompt(t("renamePrompt"), session.title);
          if (!title?.trim()) return;
          void (async () => {
            try {
              const res = await fetch(`/api/deep-research/sessions/${session.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title.trim() }),
              });
              if (!res.ok) throw new Error("rename failed");
              await mutateResearchSessions();
              toast.success(t("renamed"));
            } catch {
              toast.error(t("renameFailed"));
            }
          })();
        }}
        onDeleteResearch={(session) => {
          if (!confirm(t("deleteSession", { name: session.title }))) return;
          void (async () => {
            try {
              const res = await fetch(`/api/deep-research/sessions/${session.id}`, { method: "DELETE" });
              if (!res.ok) throw new Error("delete failed");
              await mutateResearchSessions();
              if (surface.view === "research" && surface.researchSessionId === session.id) {
                go(surfaceFromResearchFocus(surface, { sessionId: null, intake: true }));
              }
              toast.success(t("deleted"));
            } catch {
              toast.error(t("deleteFailed"));
            }
          })();
        }}
        onOpenSettings={openSettings}
        settingsActive={surface.view === "settings"}
      />

      <main className="mid">
        {/* 统一头部 —— demo 的 midhd/hdwrap */}
        <header className={`midhd${surface.view === "library" ? " midhd-library" : ""}`}>
          <div className="hdwrap">
            {(surface.view === "skills" || surface.view === "library") && (
              <button className="navback" type="button" data-tip="回到对话" aria-label="返回主对话" title="返回主对话" onClick={() => showView("agent")}>
                <ArrowLeft />
              </button>
            )}
            <span className="mtitle">{headerTitle}</span>
            <div className="tabs">
              <button className={`pill${surface.view === "skills" ? " on" : ""}`} type="button" data-tip="技能库" onClick={() => showView("skills")}>
                <Zap /><span>技能库</span>
              </button>
              <button className={`pill${surface.view === "library" ? " on" : ""}`} type="button" data-tip="文献库" onClick={() => showView("library")}>
                <FileText /><span>文献库</span>
              </button>
            </div>
          </div>
        </header>

        <div className="viewbody">
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
              onNewSession={() => { const created = createSession(); setActiveSessionId(created.id); go({ ...surface, view: "agent", previewPath: null }); }}
            />
          )}
          {surface.view === "skills" && <SkillsView workspaceId={workspace.id} />}
          {surface.view === "library" && (
            <LibraryView />
          )}
          {surface.view === "research" && (
            <DeepResearchPanel workspaceId={workspace.id} focus={focus} onFocusChange={(next: ResearchFocus) => go(surfaceFromResearchFocus(surface, next))} />
          )}
          {surface.view === "settings" && <SettingsView onBack={backFromSettings} />}
        </div>
      </main>

      {/* 右侧文件预览面板 —— demo cfp-* 视觉，保留 FilePreviewPanel 内容与关闭回调 */}
      {surface.previewPath && (
        <aside className="cfp-panel">
          <div className="cfp-hd">
            <span className="cfp-ic"><FileText /></span>
            <span className="cfp-nm">{surface.previewPath.split("/").pop()}</span>
            <div className="cfp-acts">
              <button className="cfp-ab" type="button" data-tip="复制路径" aria-label="复制路径" onClick={() => { navigator.clipboard?.writeText(surface.previewPath ?? ""); toast.success("已复制"); }}><Copy /></button>
              <button className="cfp-ab" type="button" data-tip="打开原文件" aria-label="打开原文件"><ExternalLink /></button>
              <button className="cfp-ab" type="button" data-tip="分享" aria-label="分享" onClick={() => toast("分享：演示版未接入")}><Share2 /></button>
            </div>
            <button className="cfp-x" type="button" data-tip="收起" aria-label="收起" onClick={() => go(closePreview(surface))}><PanelRightClose /></button>
          </div>
          <div className="cfp-tabs">
            <button className="cfp-tab on" type="button" data-tip="查看渲染后的文档"><Eye />预览</button>
            <button className="cfp-tab" type="button" data-tip="查看文件名、格式与操作说明"><Info />信息</button>
          </div>
          <div className="cfp-body">
            <FilePreviewPanel filePath={surface.previewPath} onClose={() => go(closePreview(surface))} />
          </div>
        </aside>
      )}

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} workspaceRoots={workspaceRoots} defaultBrowsePath={workspaceRoots[0]} />

      <TeamPanel
        open={teamPanelOpen}
        onClose={() => setTeamPanelOpen(false)}
        teams={teams}
        initialTeamId={teamPanelTeamId}
        workspaces={workspaces}
        onTeamsChanged={() => void mutateTeams()}
        onWorkspacesChanged={() => void mutateWorkspaces()}
      />
    </div>
  );
}
