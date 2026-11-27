"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { useAuthUser } from "@/lib/hooks/use-auth";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import type { Workspace } from "@/types";

interface WelcomeScreenProps {
  workspaceRoots: string[];
  onCreated?: () => void;
}

const BRAND_LOGO =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNi43MiIgcnk9IjYuNzIiIGZpbGw9IiMxNTFDMkYiLz48cmVjdCB4PSI3LjA1IiB5PSI2LjU1IiB3aWR0aD0iMi42MiIgaGVpZ2h0PSIxMC45IiByeD0iMS4zMSIgZmlsbD0iI0ZGRkZGRiIvPjxwYXRoIGQ9Ik0xMC4zIDYuNTVoMy41YTMuMDUgMy4wNSAwIDAgMSAwIDUuOUgxMC4zeiIgZmlsbD0iI0ZGRkZGRiIvPjxwYXRoIGQ9Ik0xMC4zIDEyLjloMy4yYTIuOSAyLjkgMCAwIDEgMCA1LjZIMTAuM3oiIGZpbGw9IiNGRkZGRkYiLz48Y2lyY2xlIGN4PSIxMC42IiBjeT0iMTAuMTUiIHI9IjEuNiIgZmlsbD0iIzRBNUNGNSIvPjwvc3ZnPg==";

/** 卡片只展示目录地址；路径末段若与空间名重复则去掉，避免 “/xxx/空间名/空间名”。 */
function displayFolderPath(folderPath: string, name: string) {
  const clean = folderPath.replace(/[\\/]+$/, "");
  const suffix = `/${name}`;
  return clean.endsWith(suffix) ? clean.slice(0, -suffix.length) || clean : clean;
}

function fmtDate(value?: string | number | Date) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export function WelcomeScreen({ workspaceRoots, onCreated }: WelcomeScreenProps) {
  const t = useTranslations("shell");
  const tHome = useTranslations("home");
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthUser();
  const { workspaces, isLoading, mutate } = useWorkspaces();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, router, user]);

  if (authLoading || isLoading) {
    return <main className="wl-page"><div className="ib-loading">{t("loading")}</div></main>;
  }
  if (!user) return null;

  // 无空间：创建第一个空间（逻辑保留，视觉对齐 demo onboard）
  const createFirst = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const root = workspaceRoots[0];
    if (!name || !root) {
      toast.error(t("needWorkspaceRoot"));
      return;
    }
    setPending(true);
    try {
      const folderPath = `${root.replace(/[\\/]$/, "")}/${name}`;
      const mkdirRes = await fetch("/api/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath }),
      });
      if (!mkdirRes.ok) {
        const err = await mkdirRes.json().catch(() => ({}));
        throw new Error(err.error || t("createFailed"));
      }
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, folderPath }),
      });
      if (!res.ok) throw new Error(t("createFailed"));
      const workspace = await res.json();
      router.push(`/workspace/${workspace.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("createFailed"));
    } finally {
      setPending(false);
    }
  };

  const rename = async (workspace: Workspace) => {
    const name = draft.trim();
    if (!name) return;
    const res = await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      toast.error(t("renameFailed"));
      return;
    }
    setEditingId(null);
    toast.success(t("renamed"));
    mutate();
  };

  const remove = async (workspace: Workspace) => {
    if (!confirm(tHome("deleteConfirm"))) return;
    const res = await fetch(`/api/workspaces/${workspace.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(t("deleteFailed"));
      return;
    }
    toast.success(t("deleted"));
    mutate();
    onCreated?.();
  };

  // 无空间 → demo「创建工作空间」页视觉
  if (workspaces.length === 0) {
    return (
      <main className="ib-onboard">
        <div className="ob-in">
          <h1 className="ob-title">创建你的 <span className="ob-grad">工作空间</span></h1>
          <form onSubmit={createFirst}>
            <div className="ob-sec">
              <div className="ob-secl">工作空间名称</div>
              <input className="ob-in-name" name="name" required maxLength={24} placeholder="例如：钙钛矿稳定性" />
            </div>
            <p className="ob-err">{workspaceRoots.length === 0 ? t("needWorkspaceRoot") : ""}</p>
            <button className="ob-btn" type="submit" disabled={pending || workspaceRoots.length === 0}>创建并进入</button>
          </form>
        </div>
      </main>
    );
  }

  // 有空间 → demo v4 欢迎页：hero + 自适应正方形卡片
  return (
    <main className="wl-page">
      <div className="wl-in">
        <div className="wl-hero">
          <div className="wl-badge">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.9l1.45 3.45L12.9 6.8l-3.45 1.45L8 11.7 6.55 8.25 3.1 6.8l3.45-1.45L8 1.9z"/></svg>
            <span>AI-Powered Research Assistant</span>
          </div>
          <h1 className="wl-title">Welcome to <span className="wl-grad">Innoscale</span></h1>
          <p className="wl-sub">智能研究、编码和知识管理工作空间</p>
          <div className="wl-feats">
            <span className="wl-feat"><i className="wl-dot d1" />AI Agent</span>
            <span className="wl-feat"><i className="wl-dot d2" />Code Analysis</span>
            <span className="wl-feat"><i className="wl-dot d3" />Fast Study</span>
          </div>
        </div>

        <div className="wl-sec ws-sec">
          <div className="wl-sechd">
            <div className="wsh-l">
              <span className="wsh-ico"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5.2" y="5.2" width="9.6" height="9.6" rx="2"/><rect x="8" y="8" width="4" height="4" rx="1"/><path d="M7.4 2.6v2.6M12.6 2.6v2.6M7.4 14.8v2.6M12.6 14.8v2.6M2.6 7.4h2.6M2.6 12.6h2.6M14.8 7.4h2.6M14.8 12.6h2.6"/></svg></span>
              <span className="wsh-t">我的工作空间</span>
              <span className="wsh-n" id="wsCount">{workspaces.length}</span>
            </div>
            <button className="ws-new" type="button" onClick={() => setCreateOpen(true)}>+ 新建空间</button>
          </div>
          <div className="ws-list">
            {workspaces.map((workspace, index) => (
              <div
                className="ws-card"
                key={workspace.id}
                role="button"
                tabIndex={0}
                aria-label={`进入工作空间 ${workspace.name}`}
                onClick={() => router.push(`/workspace/${workspace.id}`)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/workspace/${workspace.id}`);
                  }
                }}
              >
                <div className="wsc-top">
                  <span className="wsc-ico"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.8 5.6a1.6 1.6 0 011.6-1.6h3.3l1.6 2h6.3a1.6 1.6 0 011.6 1.6v6.8a1.6 1.6 0 01-1.6 1.6H4.4a1.6 1.6 0 01-1.6-1.6z"/></svg></span>
                  {editingId === workspace.id ? (
                    <input className="ws-inp" value={draft} autoFocus onClick={(e) => e.stopPropagation()} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") void rename(workspace); if (e.key === "Escape") setEditingId(null); }} />
                  ) : (
                    <span className="wsc-nm">{workspace.name}</span>
                  )}
                  {index === 0 && <span className="wsc-cur">当前</span>}
                </div>
                <div className="wsc-path">{displayFolderPath(workspace.folderPath, workspace.name)}</div>
                <div className="wsc-foot">
                  <span className="wsc-date"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.4 1.6"/></svg>{fmtDate(workspace.updatedAt ?? workspace.createdAt)}</span>
                  <div className="wsc-acts" onClick={(e) => e.stopPropagation()}>
                    <button className="ws-act pri" type="button" onClick={() => router.push(`/workspace/${workspace.id}`)}>进入</button>
                    <button className="ws-act" type="button" onClick={() => { setEditingId(workspace.id); setDraft(workspace.name); }}>重命名</button>
                    <button className="ws-act danger" type="button" onClick={() => void remove(workspace)}>删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceRoots={workspaceRoots}
        defaultBrowsePath={workspaceRoots[0]}
      />
    </main>
  );
}
