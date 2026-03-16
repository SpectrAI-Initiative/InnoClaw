"use client";

import React, { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil, Trash2, Zap, ZapOff, Download, Languages, Loader2 } from "lucide-react";
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

const LOCALE_LABELS: Record<string, string> = {
  zh: "中文",
  en: "English",
};

export function SkillList({
  skills,
  onEdit,
  onDelete,
  onToggleEnabled,
}: SkillListProps) {
  const t = useTranslations("skills");
  const locale = useLocale();

  const [translating, setTranslating] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translated, setTranslated] = useState(false);

  const handleTranslate = useCallback(async () => {
    if (translated) {
      // Toggle off — show original
      setTranslated(false);
      return;
    }

    const descriptionsToTranslate = skills
      .filter((s) => s.description)
      .map((s) => s.description!);

    if (descriptionsToTranslate.length === 0) return;

    setTranslating(true);
    try {
      const targetLang = LOCALE_LABELS[locale] || locale;
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: descriptionsToTranslate,
          targetLanguage: targetLang,
        }),
      });

      if (!res.ok) {
        console.error("Translation failed:", await res.text());
        return;
      }

      const { translations: results } = await res.json();
      const map: Record<string, string> = {};
      let idx = 0;
      for (const skill of skills) {
        if (skill.description) {
          map[skill.id] = results[idx] || skill.description;
          idx++;
        }
      }
      setTranslations(map);
      setTranslated(true);
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setTranslating(false);
    }
  }, [skills, locale, translated]);

  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Zap className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[40%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left font-medium px-4 py-3">{t("name")}</th>
            <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
              <div className="flex items-center gap-2">
                <span>{t("description")}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleTranslate}
                        disabled={translating}
                        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-normal cursor-pointer hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {translating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Languages className="h-3 w-3" />
                        )}
                        <span>{translated ? t("showOriginal") : t("aiTranslate")}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{t("aiTranslateHint")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </th>
            <th className="text-left font-medium px-4 py-3">{t("scope")}</th>
            <th className="text-left font-medium px-4 py-3">{t("status")}</th>
            <th className="text-right font-medium px-4 py-3">{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => (
            <tr
              key={skill.id}
              className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${!skill.isEnabled ? "opacity-60" : ""}`}
            >
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span className="font-medium truncate">{skill.name}</span>
                  <Badge variant="secondary" className="font-mono text-xs w-fit">
                    /{skill.slug}
                  </Badge>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                <span className="line-clamp-2">
                  {translated && translations[skill.id]
                    ? translations[skill.id]
                    : skill.description || "—"}
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge variant={skill.workspaceId ? "outline" : "default"}>
                  {skill.workspaceId ? t("workspace") : t("global")}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onToggleEnabled(skill)}
                  className="inline-flex items-center gap-1 text-xs cursor-pointer hover:opacity-80"
                >
                  {skill.isEnabled ? (
                    <>
                      <Zap className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      <span className="text-green-700 dark:text-green-400">{t("enabled")}</span>
                    </>
                  ) : (
                    <>
                      <ZapOff className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{t("disabled")}</span>
                    </>
                  )}
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(skill)}
                    title={t("edit")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleExport(skill)}
                    title={t("export")}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(skill)}
                    title={t("delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
