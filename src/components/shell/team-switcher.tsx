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
  teams, currentWorkspace, activeTeamId,
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

  useEffect(() => {
    if (!open) {
      setCreating(false);
      setName("");
    }
  }, [open]);

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;
  const label = activeTeam ? activeTeam.name : "个人空间";
  const inPersonal = !activeTeam;

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

  function selectPersonal() {
    onSelectTeam(null);
    onSelectWorkspace(currentWorkspace.id);
    setOpen(false);
  }

  return (
    <div className="ts-wrap" ref={ref}>
      <button
        type="button"
        className={`ts-trigger${activeTeam ? " team" : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ts-trigger-ico">{activeTeam ? <Users /> : <User />}</span>
        <span className="ts-label">{label}</span>
        <ChevronDown className="ts-arrow" />
      </button>

      {open && (
        <div className="ts-menu" role="listbox" aria-label="切换空间">
          <div className="ts-hd">切换空间</div>

          <button
            type="button"
            role="option"
            aria-selected={inPersonal}
            className={`ts-row${inPersonal ? " on" : ""}`}
            onClick={selectPersonal}
          >
            <span className="ts-row-ico"><User /></span>
            <span className="ts-row-meta">
              <b>个人空间</b>
              <small>仅你可见</small>
            </span>
            {inPersonal && <Check className="ts-check" aria-hidden />}
          </button>

          <div className="ts-group">
            <div className="ts-group-label">团队</div>
            {teams.length === 0 ? (
              <div className="ts-empty">还没有团队，创建一个开始协作</div>
            ) : (
              teams.map((t) => {
                const on = activeTeamId === t.id;
                const role =
                  t.myRole === "owner" ? "所有者" : t.myRole === "admin" ? "管理员" : "成员";
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`ts-row${on ? " on" : ""}`}
                    onClick={() => { onSelectTeam(t.id); setOpen(false); }}
                  >
                    <span className="ts-row-ico team">{t.name.slice(0, 1).toUpperCase()}</span>
                    <span className="ts-row-meta">
                      <b>{t.name}</b>
                      <small>{t.plan.toUpperCase()} · {role}</small>
                    </span>
                    {on && <Check className="ts-check" aria-hidden />}
                  </button>
                );
              })
            )}
          </div>

          <div className="ts-foot">
            {creating ? (
              <form className="ts-create" onSubmit={createTeam}>
                <input
                  autoFocus
                  placeholder="团队名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
                <button type="submit" disabled={busy || !name.trim()}>
                  {busy ? <Loader2 className="tm-spin" /> : "创建"}
                </button>
                <button
                  type="button"
                  className="ts-create-cancel"
                  disabled={busy}
                  onClick={() => { setCreating(false); setName(""); }}
                >
                  取消
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  className="ts-action"
                  onClick={() => setCreating(true)}
                >
                  <Plus />
                  <span>新建团队</span>
                </button>
                <button
                  type="button"
                  className="ts-action"
                  onClick={() => { setOpen(false); onManageTeam(activeTeamId); }}
                >
                  <Settings2 />
                  <span>管理团队</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
