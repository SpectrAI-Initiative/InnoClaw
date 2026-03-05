"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FolderOpen, GitBranch } from "lucide-react";
import { Header } from "@/components/layout/header";
import { WorkspaceList } from "@/components/workspaces/workspace-list";
import { OpenWorkspaceDialog } from "@/components/workspaces/open-workspace-dialog";
import { CloneRepoDialog } from "@/components/git/clone-repo-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import { toast } from "sonner";

export default function HomePage() {
  const t = useTranslations("home");
  const { workspaces, isLoading, mutate } = useWorkspaces();
  const [workspaceRoots, setWorkspaceRoots] = useState<string[]>([]);

  useEffect(() => {
    // Fetch workspace roots from settings API
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.workspaceRoots) {
          setWorkspaceRoots(data.workspaceRoots);
        }
      })
      .catch(() => {});
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return;

    try {
      await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
      mutate();
    } catch {
      toast.error("Failed to delete workspace");
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <ScrollArea className="flex-1">
        <main className="container px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <div className="flex gap-2">
            <CloneRepoDialog
              trigger={
                <Button variant="outline">
                  <GitBranch className="mr-2 h-4 w-4" />
                  {t("cloneFromGithub")}
                </Button>
              }
            />
            <OpenWorkspaceDialog
              workspaceRoots={workspaceRoots}
              trigger={
                <Button>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t("openWorkspace")}
                </Button>
              }
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg border bg-muted"
              />
            ))}
          </div>
        ) : (
          <WorkspaceList workspaces={workspaces} onDelete={handleDelete} />
        )}
        </main>
      </ScrollArea>
    </div>
  );
}
