"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { FolderOpen, GitBranch, Trash2, ArrowRight, Clock } from "lucide-react";
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
      <Card className="group relative cursor-pointer overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <CardHeader className="relative pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors duration-300 group-hover:bg-primary/20">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold transition-colors duration-300 group-hover:text-primary">
                  {workspace.name}
                </CardTitle>
                {workspace.isGitRepo && (
                  <Badge variant="secondary" className="mt-1 gap-1 text-[10px] font-normal">
                    <GitBranch className="h-2.5 w-2.5" />
                    Git
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(workspace.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="mt-2 truncate text-xs font-mono text-muted-foreground/70">
            {workspace.folderPath}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>{lastOpened}</span>
            </div>
            <div className="flex items-center gap-1 text-primary opacity-0 transition-all duration-300 group-hover:opacity-100">
              <span className="text-xs font-medium">{t("open") || "Open"}</span>
              <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
