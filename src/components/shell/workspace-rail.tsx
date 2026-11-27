"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Folder, Plus, Sun, MoreHorizontal, Pencil } from "lucide-react";
import type { AgentSession } from "@/lib/hooks/use-agent-sessions";
import type { DeepResearchSession } from "@/lib/deep-research/types";
import { isCompletedSessionStatus } from "@/lib/deep-research/session-status";
import type { Workspace } from "@/types";

const BRAND_LOGO =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNi43MiIgcnk9IjYuNzIiIGZpbGw9IiMxNTFDMkYiLz48cmVjdCB4PSI3LjA1IiB5PSI2LjU1IiB3aWR0aD0iMi42MiIgaGVpZ2h0PSIxMC45IiByeD0iMS4zMSIgZmlsbD0iI0ZGRkZGRiIvPjxwYXRoIGQ9Ik0xMC4zIDYuNTVoMy41YTMuMDUgMy4wNSAwIDAgMSAwIDUuOUgxMC4zeiIgZmlsbD0iI0ZGRkZGRiIvPjxwYXRoIGQ9Ik0xMC4zIDEyLjloMy4yYTIuOSAyLjkgMCAwIDEgMCA1LjZIMTAuM3oiIGZpbGw9IiNGRkZGRkYiLz48Y2lyY2xlIGN4PSIxMC42IiBjeT0iMTAuMTUiIHI9IjEuNiIgZmlsbD0iIzRBNUNGNSIvPjwvc3ZnPg==";

interface WorkspaceRailProps {
  workspaces: Workspace[];
  current: Workspace;
  sessions: AgentSession[];
  activeSessionId: string;
  researchSessions: DeepResearchSession[];
  activeResearchId: string | null;
  researchActive: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onBrand: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onRenameWorkspace: () => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (session: AgentSession) => void;
  onDeleteSession: (session: AgentSession) => void;
  onCreateSession: () => void;
  onSelectResearch: (sessionId: string) => void;
  onCreateResearch: () => void;
  onRenameResearch: (session: DeepResearchSession) => void;
  onDeleteResearch: (session: DeepResearchSession) => void;
  onOpenSettings: () => void;
  settingsActive: boolean;
}

export function WorkspaceRail({
  workspaces, current,
  sessions, activeSessionId, researchSessions, activeResearchId,
  researchActive, menuOpen, onToggleMenu, onBrand, onSelectWorkspace, onCreateWorkspace, onRenameWorkspace,
  onSelectSession, onRenameSession, onDeleteSession, onCreateSession, onSelectResearch,
  onCreateResearch, onRenameResearch, onDeleteResearch, onOpenSettings, settingsActive,
}: WorkspaceRailProps) {
  const t = useTranslations("shell");
  const others = workspaces.filter((workspace) => workspace.id !== current.id);
  type RailMenu = { x: number; y: number; session: AgentSession; kind: "agent" } | { x: number; y: number; session: DeepResearchSession; kind: "research" };
  const [menu, setMenu] = useState<RailMenu | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); };
  }, [menu]);

  return (
    <aside className="rail">
      {/* 品牌 —— 与截图一致：Innoscale */}
      <button type="button" onClick={onBrand} className="brand" aria-label="返回对话">
        <span className="mk" style={{ backgroundImage: `url("${BRAND_LOGO}")`, backgroundSize: "24px 24px", backgroundRepeat: "no-repeat" }} aria-hidden="true" />
        <span className="nm">Innoscale</span>
      </button>

      {/* 工作空间下拉 */}
      <div className="p21-top">
        <button className="p21-cur" type="button" aria-expanded={menuOpen} onClick={onToggleMenu} data-tip="切换工作空间">
          <Folder className="p21-ico" />
          <span className="p21-nm">{current.name}</span>
          <ChevronDown className="p21-arw" />
        </button>
        {menuOpen && (
          <div className="p21-drop">
            <div className="p21-dhd">{t("switchWorkspace")}</div>
            {others.length === 0 && <div className="p21-di">{t("noOtherWorkspace")}</div>}
            {others.map((workspace) => (
              <button key={workspace.id} type="button" className="p21-di" onClick={() => onSelectWorkspace(workspace.id)}>
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              </button>
            ))}
            <div className="p21-dsep" />
            <button type="button" className="p21-drename" onClick={onRenameWorkspace}>
              <Pencil className="h-3.5 w-3.5" />{t("rename")}
            </button>
            <button type="button" className="p21-dnew" onClick={onCreateWorkspace}>
              <Plus className="h-3.5 w-3.5" />{t("newWorkspace")}
            </button>
          </div>
        )}
      </div>

      {/* 任务分组 —— 严格对齐参考文件 p21-grp 结构：分组头(标题+新建) + 任务列表 */}
      <div className="p21-groups">
        {/* Agent 分组 */}
        <div className="p21-grp">
          <div className="p21-ghd">
            <span className="p21-gt">Agent</span>
            <button type="button" className="p21-gnew" onClick={onCreateSession} data-tip="新建 Agent">
              <Plus className="h-3 w-3" />新建
            </button>
          </div>
          <div className="p21-tasks">
            {sessions.map((session) => {
              const selected = !researchActive && session.id === activeSessionId;
              return (
                <div key={session.id} className={`p21-t${selected ? " cur" : ""}`} role="button" tabIndex={0}
                  onClick={() => onSelectSession(session.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") onSelectSession(session.id); }}>
                  <span className="p21-dot run" />
                  <span className="p21-tn">{session.name}</span>
                  <button type="button" className="p21-more" data-act="menu" data-tip="更多"
                    onClick={(e) => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, session, kind: "agent" }); }}
                    aria-label="任务更多操作">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Deep Research 分组 —— 紧跟 Agent，对齐参考文件 */}
        <div className="p21-grp dr">
          <div className="p21-ghd">
            <span className="p21-gt">Deep research</span>
            <button type="button" className="p21-gnew" onClick={onCreateResearch} data-tip="新建 Deep research">
              <Plus className="h-3 w-3" />新建
            </button>
          </div>
          <div className="p21-tasks">
            {researchSessions.map((session) => {
              const selected = researchActive && session.id === activeResearchId;
              const done = isCompletedSessionStatus(session.status);
              return (
                <div key={session.id} className={`p21-t dr-item${selected ? " cur" : ""}`} role="button" tabIndex={0}
                  onClick={() => onSelectResearch(session.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") onSelectResearch(session.id); }}>
                  <span className={`p21-dot${done ? " done" : " run"}`} />
                  <span className="p21-tn">{session.title}</span>
                  <button type="button" className="p21-more" data-act="menu" data-tip="更多"
                    onClick={(e) => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, session, kind: "research" }); }}
                    aria-label="任务更多操作">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 底部设置 */}
      <div className="railft">
        <button type="button" className={`gear${settingsActive ? " on" : ""}`} onClick={onOpenSettings} data-tip="设置" aria-label="设置">
          <Sun className="h-4 w-4" />
          <span className="gearlbl">设置</span>
        </button>
      </div>

      {/* 任务更多菜单 —— 对齐参考文件 p21-menu */}
      {menu && (
        <div className="p21-menu on" style={{ left: Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 9999) - 140), top: menu.y + 8 }}
          onClick={(e) => e.stopPropagation()} role="menu">
          <button type="button" className="p21-mi" role="menuitem" onClick={() => {
            if (menu.kind === "agent") onRenameSession(menu.session); else onRenameResearch(menu.session);
            setMenu(null);
          }}>重命名</button>
          <button type="button" className="p21-mi danger" role="menuitem" onClick={() => {
            if (menu.kind === "agent") onDeleteSession(menu.session); else onDeleteResearch(menu.session);
            setMenu(null);
          }}>删除任务</button>
        </div>
      )}
    </aside>
  );
}
