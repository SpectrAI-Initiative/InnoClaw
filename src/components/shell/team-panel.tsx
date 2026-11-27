"use client";

import { useEffect, useState } from "react";
import {
  X, Users, FolderOpen, Settings2, Plus, Trash2, ShieldCheck,
  Crown, UserPlus, Check, ChevronRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Team, TeamDetail, TeamMember, TeamRole, Workspace } from "@/types";
import { useTeamDetail } from "@/lib/hooks/use-teams";

type Pane = "team" | "members" | "workspaces";

interface TeamPanelProps {
  open: boolean;
  onClose: () => void;
  teams: Team[];
  initialTeamId?: string | null;
  workspaces: Workspace[];
  onTeamsChanged: () => void;
  onWorkspacesChanged: () => void;
}

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "所有者",
  admin: "管理员",
  member: "成员",
};

export function TeamPanel({
  open, onClose, teams, initialTeamId, workspaces, onTeamsChanged, onWorkspacesChanged,
}: TeamPanelProps) {
  const [activeId, setActiveId] = useState<string | null>(initialTeamId ?? null);
  const [pane, setPane] = useState<Pane>("members");
  const { team, mutate } = useTeamDetail(open ? activeId : null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveId(initialTeamId ?? teams[0]?.id ?? null);
      setPane("members");
    }
  }, [open, initialTeamId, teams]);

  if (!open) return null;

  const canManage = team?.myRole === "owner" || team?.myRole === "admin";
  const isOwnerRole = team?.myRole === "owner";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!team || !inviteEmail.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "邀请失败");
      toast.success(`已邀请 ${inviteEmail.trim()} 加入团队`);
      setInviteEmail("");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "邀请失败");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(member: TeamMember, role: TeamRole) {
    if (!team) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "修改角色失败");
      toast.success("角色已更新");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "修改角色失败");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member: TeamMember) {
    if (!team) return;
    if (!window.confirm(`确定将 ${member.name || member.email} 移出团队？`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/members/${member.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "移出失败");
      toast.success("成员已移出");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移出失败");
    } finally {
      setBusy(false);
    }
  }

  async function shareWorkspace(wsId: string) {
    if (!team) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: wsId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "共享失败");
      toast.success("工作区已共享给团队");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "共享失败");
    } finally {
      setBusy(false);
    }
  }

  async function unshareWorkspace(wsId: string) {
    if (!team) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/workspaces/${wsId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "取消共享失败");
      }
      toast.success("已取消共享");
      await mutate();
      onWorkspacesChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "取消共享失败");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTeam() {
    if (!team) return;
    if (!window.confirm(`确定解散团队「${team.name}」？此操作不可恢复。`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "解散失败");
      }
      toast.success("团队已解散");
      onTeamsChanged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "解散失败");
    } finally {
      setBusy(false);
    }
  }

  const sharedIds = new Set((team?.workspaces ?? []).map((w) => w.id));
  const availableWorkspaces = workspaces.filter((w) => !sharedIds.has(w.id));

  return (
    <div className="tm-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tm-modal" role="dialog" aria-modal="true" aria-label="管理团队">
        <button className="tm-close" type="button" onClick={onClose} aria-label="关闭"><X /></button>

        {/* 左栏：团队列表 + 分组菜单 */}
        <aside className="tm-side">
          <div className="tm-side-title">管理团队</div>
          <div className="tm-side-grp">团队</div>
          <div className="tm-team-list">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tm-team-item${t.id === activeId ? " on" : ""}`}
                onClick={() => { setActiveId(t.id); setPane("members"); }}
              >
                <span className="tm-team-avatar">{t.name.slice(0, 1).toUpperCase()}</span>
                <span className="tm-team-meta">
                  <b>{t.name}</b>
                  <small>{t.plan.toUpperCase()} · {ROLE_LABEL[t.myRole ?? "member"]}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="tm-side-grp">管理</div>
          <button type="button" className={`tm-nav${pane === "members" ? " on" : ""}`} onClick={() => setPane("members")}>
            <Users />成员
          </button>
          <button type="button" className={`tm-nav${pane === "workspaces" ? " on" : ""}`} onClick={() => setPane("workspaces")}>
            <FolderOpen />共享工作区
          </button>
          <button type="button" className={`tm-nav${pane === "team" ? " on" : ""}`} onClick={() => setPane("team")}>
            <Settings2 />团队设置
          </button>
        </aside>

        {/* 右栏 */}
        <div className="tm-main">
          {!team ? (
            <div className="tm-empty">
              <Users />
              <p>左侧还没有团队。先在空间切换器里创建一个团队吧。</p>
            </div>
          ) : (
            <>
              <div className="tm-main-head">
                <div>
                  <h2>{team.name}</h2>
                  <p>{pane === "members" ? `${team.members.length} 名成员 · 数据在同一团队内共享` :
                    pane === "workspaces" ? "把工作区共享给全队，成员按角色访问同一份数据" : "团队基本信息与方案"}
                  </p>
                </div>
                <span className="tm-plan-badge">{team.plan.toUpperCase()}</span>
              </div>

              {pane === "members" && (
                <div className="tm-pane">
                  <div className="tm-member-list">
                    {team.members.map((m) => (
                      <div key={m.id} className="tm-member">
                        <span className="tm-avatar">{m.name.slice(0, 1).toUpperCase()}</span>
                        <span className="tm-member-info">
                          <b>{m.name}{m.role === "owner" && <Crown className="tm-crown" />}{m.userId === team.ownerUserId ? "" : ""}</b>
                          <small>{m.email}</small>
                        </span>
                        <span className="tm-member-role">{ROLE_LABEL[m.role]}</span>
                        {canManage && m.role !== "owner" && (
                          <select
                            className="tm-role-select"
                            value={m.role}
                            disabled={busy}
                            onChange={(e) => changeRole(m, e.target.value as TeamRole)}
                            aria-label="修改角色"
                          >
                            <option value="member">成员</option>
                            <option value="admin">管理员</option>
                          </select>
                        )}
                        {canManage && m.role !== "owner" && (
                          <button type="button" className="tm-icon-btn" disabled={busy} onClick={() => removeMember(m)} aria-label="移出团队">
                            <Trash2 />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {canManage && (
                    <form className="tm-invite" onSubmit={invite}>
                      <UserPlus />
                      <input
                        type="email"
                        placeholder="输入已注册用户的邮箱邀请加入"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                      <button type="submit" className="tm-btn primary" disabled={busy}>
                        {busy ? <Loader2 className="tm-spin" /> : <><Plus />邀请</>}
                      </button>
                    </form>
                  )}
                  <p className="tm-hint"><ShieldCheck /> 团队算力由团队订阅提供；成员只能看到显式共享的数据，私人对话彼此不可见。</p>
                </div>
              )}

              {pane === "workspaces" && (
                <div className="tm-pane">
                  <div className="tm-sub-h">已共享给团队的工作区</div>
                  <div className="tm-ws-list">
                    {team.workspaces.length === 0 && <p className="tm-muted">还没有共享工作区。</p>}
                    {team.workspaces.map((w) => (
                      <div key={w.id} className="tm-ws">
                        <FolderOpen />
                        <span><b>{w.name}</b><small>{w.folderPath}</small></span>
                        {canManage && (
                          <button type="button" className="tm-text-btn" disabled={busy} onClick={() => unshareWorkspace(w.id)}>取消共享</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canManage && availableWorkspaces.length > 0 && (
                    <>
                      <div className="tm-sub-h">把我的工作区共享给团队</div>
                      <div className="tm-ws-add">
                        {availableWorkspaces.map((w) => (
                          <button key={w.id} type="button" disabled={busy} onClick={() => shareWorkspace(w.id)}>
                            <Plus />{w.name}<ChevronRight />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="tm-hint"><Check /> 共享的是数据本体而非复制件；成员进入团队空间后读写的是同一份文件与文献。</p>
                </div>
              )}

              {pane === "team" && (
                <div className="tm-pane">
                  <div className="tm-kv"><span>团队名称</span><b>{team.name}</b></div>
                  <div className="tm-kv"><span>方案</span><b>{team.plan.toUpperCase()}</b></div>
                  <div className="tm-kv"><span>我的角色</span><b>{ROLE_LABEL[team.myRole ?? "member"]}</b></div>
                  <div className="tm-kv"><span>创建时间</span><b>{team.createdAt}</b></div>
                  {team.description && <div className="tm-kv"><span>描述</span><b>{team.description}</b></div>}
                  <div className="tm-team-actions">
                    <button type="button" className="tm-btn" onClick={() => toast.info("团队设置编辑将在后续版本开放")}>编辑信息</button>
                    {isOwnerRole && (
                      <button type="button" className="tm-btn danger" disabled={busy} onClick={deleteTeam}>
                        <Trash2 />解散团队
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
