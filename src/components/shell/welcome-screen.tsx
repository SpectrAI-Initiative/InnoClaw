"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { useAuthUser } from "@/lib/hooks/use-auth";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import type { Workspace } from "@/types";

interface WelcomeScreenProps {
  workspaceRoots: string[];
  onCreated?: () => void;
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
    return <main className="grid min-h-screen place-items-center text-sm text-[#8A8A92]">{t("loading")}</main>;
  }

  if (!user) return null;

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

  if (workspaces.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-4">
        <form onSubmit={createFirst} className="w-full max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight">{t("onboardTitle")}</h1>
          <p className="mt-2 text-sm text-[#8A8A92]">{t("onboardHint")}</p>
          <Input name="name" required maxLength={24} placeholder={t("workspaceName")} className="mt-6" />
          <Button className="mt-4 w-full" type="submit" disabled={pending || workspaceRoots.length === 0}>
            {t("createAndEnter")}
          </Button>
          {workspaceRoots.length === 0 && <p className="mt-3 text-sm text-red-700">{t("needWorkspaceRoot")}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-white px-4">
      <div className="w-full max-w-xl">
        <p className="text-xs font-medium text-[#2563EB]">{t("badge")}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{t("welcomeTitle")}</h1>
        <p className="mt-2 text-sm text-[#8A8A92]">{t("welcomeSubtitle")}</p>
        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("myWorkspaces")} <span className="text-[#8A8A92]">{workspaces.length}</span></h2>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>{t("newWorkspace")}</Button>
        </div>
        <div className="mt-3 space-y-2">
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="flex h-[52px] items-center gap-2 rounded-xl border border-[#EDEDED] px-3">
              {editingId === workspace.id ? (
                <Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void rename(workspace); }} />
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm">{workspace.name}</span>
              )}
              <Button size="sm" onClick={() => router.push(`/workspace/${workspace.id}`)}>{t("enter")}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingId(workspace.id); setDraft(workspace.name); }}>{t("rename")}</Button>
              <Button size="sm" variant="ghost" onClick={() => void remove(workspace)}>{t("delete")}</Button>
            </div>
          ))}
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
