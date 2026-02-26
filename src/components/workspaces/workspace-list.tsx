"use client";

import { useTranslations } from "next-intl";
import { Workspace } from "@/types";
import { WorkspaceCard } from "./workspace-card";

interface WorkspaceListProps {
  workspaces: Workspace[];
  onDelete: (id: string) => void;
}

export function WorkspaceList({ workspaces, onDelete }: WorkspaceListProps) {
  const t = useTranslations("home");

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {workspaces.map((workspace) => (
        <WorkspaceCard
          key={workspace.id}
          workspace={workspace}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
