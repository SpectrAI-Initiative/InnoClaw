"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Zap, ZapOff, Download } from "lucide-react";
import type { Skill } from "@/types";

interface SkillListProps {
  skills: Skill[];
  onEdit: (skill: Skill) => void;
  onDelete: (skill: Skill) => void;
  onToggleEnabled: (skill: Skill) => void;
}

function handleExport(skill: Skill) {
  window.open(`/api/skills/${skill.id}/export`, "_blank");
}

export function SkillList({
  skills,
  onEdit,
  onDelete,
  onToggleEnabled,
}: SkillListProps) {
  const t = useTranslations("skills");

  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Zap className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {skills.map((skill) => (
        <Card
          key={skill.id}
          className={!skill.isEnabled ? "opacity-60" : ""}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{skill.name}</CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  /{skill.slug}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={skill.workspaceId ? "outline" : "default"}>
                  {skill.workspaceId ? t("workspace") : t("global")}
                </Badge>
              </div>
            </div>
            {skill.description && (
              <CardDescription className="text-xs mt-1">
                {skill.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              {skill.steps && skill.steps.length > 0 && (
                <span>
                  {skill.steps.length} {t("steps").toLowerCase()}
                </span>
              )}
              {skill.allowedTools && (
                <span>
                  {skill.allowedTools.length} {t("toolPermissions").toLowerCase()}
                </span>
              )}
              {skill.parameters && skill.parameters.length > 0 && (
                <span>
                  {skill.parameters.length} {t("parameters").toLowerCase()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleEnabled(skill)}
              >
                {skill.isEnabled ? (
                  <Zap className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <ZapOff className="h-3.5 w-3.5 mr-1" />
                )}
                {skill.isEnabled ? t("enabled") : t("disabled")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(skill)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {t("edit")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExport(skill)}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                {t("export")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(skill)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t("delete")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
