"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, User, Users, Plus, Settings2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Team, Workspace } from "@/types";

interface TeamSwitcherProps {
  teams: Team[];
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  activeTeamId: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onSelectTeam: (teamId: string | null) => void;
  onManageTeam: (teamId?: string | null) => void;
  onCreated: () => void;
}

export function TeamSwitcher({
  teams, workspaces, currentWorkspace, activeTeamId,
  onSelectWorkspace, onSelectTeam, onManageTeam, onCreated,
}: TeamSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;
  const label = activeTeam ? activeTeam.name : "个人空间";

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      toast.success(`团队「${name.trim()}」已创建`);
      setName("");
      setCreating(false);
      setOpen(false);
      onCreated();
      onManageTeam(data.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ts-wrap" ref={ref}>
      <button
        type="button"
        className={`ts-trigger${activeTeam ? " team" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {activeTeam ? <Users /> : <User />}
        <span className="ts-label">{label}</span>
        <ChevronDown className="ts-arrow" />
      </button>

      {open && (
        <div className="ts-menu">
          <div className="ts-hd">切换空间</div>

          {/* 个人空间：列出个人工作区 */}
          <div className="ts-group-label">个人空间</div>
          {workspaces.filter((w) => !w.id.startsWith("__")).slice(0, 8).map((w) => (
            <button
              key={w.id}
              type="button"
              className={`ts-row${!activeTeam && w.id === currentWorkspace.id ? " on" : ""}`}
              onClick={() => { onSelectTeam(null); onSelectWorkspace(w.id); setOpen(false); }}
            >
              <span className="ts-row-ico"><User /></span>
              <span className="ts-row-meta"><b>{w.name}</b><small>仅你可见</small></span>
              {!activeTeam && w.id === currentWorkspace.id && <Check className="ts-check" />}
            </button>
          ))}

          {/* 团队空间 */}
          <div className="ts-group-label">团队空间</div>
          {teams.length === 0 && <div className="ts-empty">还没有团队</div>}
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ts-row${activeTeamId === t.id ? " on" : ""}`}
              onClick={() => { onSelectTeam(t.id); setOpen(false); }}
            >
              <span className="ts-row-ico team">{t.name.slice(0, 1).toUpperCase()}</span>
              <span className="ts-row-meta"><b>{t.name}</b><small>{t.plan.toUpperCase()} · {t.myRole === "owner" ? "所有者" : t.myRole === "admin" ? "管理员" : "成员"}</small></span>
              {activeTeamId === t.id && <Check className="ts-check" />}
            </button>
          ))}

          <div className="ts-sep" />
          <button type="button" className="ts-action" onClick={() => { setCreating((v) => !v); }}>
            <Plus />新建团队
          </button>
          <button type="button" className="ts-action" onClick={() => { setOpen(false); onManageTeam(activeTeamId); }}>
            <Settings2 />管理团队
          </button>

          {creating && (
            <form className="ts-create" onSubmit={createTeam}>
              <input autoFocus placeholder="团队名称" value={name} onChange={(e) => setName(e.target.value)} />
              <button type="submit" disabled={busy}>{busy ? <Loader2 className="tm-spin" /> : "创建"}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
