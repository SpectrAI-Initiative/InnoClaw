"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, Folder, Plus, Settings } from "lucide-react";
import type { AgentSession } from "@/lib/hooks/use-agent-sessions";
import type { DeepResearchSession } from "@/lib/deep-research/types";
import { isCompletedSessionStatus } from "@/lib/deep-research/session-status";
import type { Workspace } from "@/types";

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
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (session: AgentSession) => void;
  onDeleteSession: (session: AgentSession) => void;
  onCreateSession: () => void;
  onSelectResearch: (sessionId: string) => void;
  onCreateResearch: () => void;
  onOpenSettings: () => void;
  settingsActive: boolean;
}

export function WorkspaceRail({
  workspaces,
  current,
  sessions,
  activeSessionId,
  researchSessions,
  activeResearchId,
  researchActive,
  menuOpen,
  onToggleMenu,
  onBrand,
  onSelectWorkspace,
  onCreateWorkspace,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onCreateSession,
  onSelectResearch,
  onCreateResearch,
  onOpenSettings,
  settingsActive,
}: WorkspaceRailProps) {
  const t = useTranslations("shell");
  const others = workspaces.filter((workspace) => workspace.id !== current.id);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[#e7e7e8] bg-[#F7F7F8]">
      <button type="button" onClick={onBrand} className="flex items-center gap-2 px-3.5 pb-1 pt-4 text-left">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-[#1B5561] text-[11px] font-semibold text-white">In</span>
        <span className="text-xl font-semibold tracking-tight text-[#171716]">Innobuddy</span>
      </button>

      <div className="relative mx-2 mt-3">
        <button
          type="button"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-[#EFEFF1]"
        >
          <Folder className="h-3.5 w-3.5 shrink-0 text-[#71717A]" />
          <span className="min-w-0 flex-1 truncate font-medium">{current.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[#8A8A92]" />
        </button>
        {menuOpen && (
          <div className="absolute left-0 right-0 top-9 z-30 rounded-lg border border-[#e7e7e8] bg-white p-1 shadow-sm">
            <div className="px-2 py-1 text-[10px] text-[#8A8A92]">{t("switchWorkspace")}</div>
            {others.length === 0 && <div className="px-2 py-1.5 text-xs text-[#8A8A92]">{t("noOtherWorkspace")}</div>}
            {others.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => onSelectWorkspace(workspace.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#F6F6F4]"
              >
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              </button>
            ))}
            <button type="button" onClick={onCreateWorkspace} className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[#C2410C] hover:bg-[#F6F6F4]">
              <Plus className="h-3.5 w-3.5" />
              {t("newWorkspace")}
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <section>
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="text-[10.5px] font-bold uppercase tracking-widest text-[#B45B36]">{t("agentGroup")}</span>
            <button type="button" onClick={onCreateSession} className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#E6E6E9] bg-white px-2 py-0.5 text-[10.5px] text-[#71717A] hover:bg-[#FAFAFB]">
              <Plus className="h-3 w-3" />
              {t("new")}
            </button>
          </div>
          {sessions.map((session) => {
            const selected = !researchActive && session.id === activeSessionId;
            return (
              <div key={session.id} className={`group flex h-8 items-center gap-2 rounded-md px-2 ${selected ? "bg-white shadow-sm ring-1 ring-[#EAEAEC]" : "hover:bg-[#EFEFF1]"}`}>
                <button type="button" onClick={() => onSelectSession(session.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D2703F]" />
                  <span className={`truncate text-[12.5px] ${selected ? "font-semibold text-[#18181B]" : "text-[#52525B]"}`}>{session.name}</span>
                </button>
                <button type="button" className="text-[10px] text-[#8A8A92] opacity-0 group-hover:opacity-100" onClick={() => onRenameSession(session)}>{t("rename")}</button>
                <button type="button" className="text-[10px] text-[#8A8A92] opacity-0 group-hover:opacity-100" onClick={() => onDeleteSession(session)}>{t("delete")}</button>
              </div>
            );
          })}
        </section>

        <section className="mt-4 border-t border-[#E9E9EC] pt-3">
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="text-[10.5px] font-bold uppercase tracking-widest text-[#6C63B4]">{t("researchGroup")}</span>
            <button type="button" onClick={onCreateResearch} className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#E7E4F3] bg-white px-2 py-0.5 text-[10.5px] text-[#6C63B4] hover:bg-[#F7F6FD]">
              <Plus className="h-3 w-3" />
              {t("new")}
            </button>
          </div>
          {researchSessions.map((session) => {
            const selected = researchActive && session.id === activeResearchId;
            const done = isCompletedSessionStatus(session.status);
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectResearch(session.id)}
                className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left ${selected ? "bg-white shadow-sm ring-1 ring-[#E6E3F4]" : "hover:bg-[#EFEFF1]"}`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${done ? "bg-[#4CA97C]" : "bg-[#7B72C6]"}`} />
                <span className={`truncate text-[12.5px] ${selected ? "font-semibold text-[#4E46A0]" : "text-[#6C63B4]"}`}>{session.title}</span>
              </button>
            );
          })}
        </section>
      </div>

      <div className="border-t border-[#E9E9EC] p-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${settingsActive ? "bg-white shadow-sm" : "text-[#52525B] hover:bg-[#EFEFF1]"}`}
        >
          <Settings className="h-4 w-4" />
          {t("settings")}
        </button>
      </div>
    </aside>
  );
}
