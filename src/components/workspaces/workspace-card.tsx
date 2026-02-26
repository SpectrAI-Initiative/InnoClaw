"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { FolderOpen, GitBranch, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Workspace } from "@/types";

interface WorkspaceCardProps {
  workspace: Workspace;
  onDelete: (id: string) => void;
}

export function WorkspaceCard({ workspace, onDelete }: WorkspaceCardProps) {
  const t = useTranslations("home");

  const lastOpened = new Date(workspace.lastOpenedAt).toLocaleDateString();

  return (
    <Link href={`/workspace/${workspace.id}`}>
      <Card className="group cursor-pointer transition-colors hover:bg-accent/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{workspace.name}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(workspace.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="truncate text-xs">
            {workspace.folderPath}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {workspace.isGitRepo && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <GitBranch className="h-3 w-3" />
                Git
              </Badge>
            )}
            <span>
              {t("lastOpened")}: {lastOpened}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
