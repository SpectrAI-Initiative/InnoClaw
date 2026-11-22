"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil, Trash2, Zap, ZapOff, Download, Languages, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  SKILL_CATEGORY_IDS,
  categorizeSkill,
  filterSkills,
  type SkillCategoryId,
} from "@/lib/skills/skill-categories";
import {
  readSkillTranslationCache,
  skillTranslationKey,
  writeSkillTranslationCache,
} from "@/lib/skills/skill-translation-cache";
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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SkillCategoryId | "all">("all");

  // Restore cached translations for this locale and show them right away, so
  // descriptions translated once do not need another (slow, paid) AI call.
  useEffect(() => {
    if (locale === "en") return;
    const cache = readSkillTranslationCache(locale);
    const map: Record<string, string> = {};
    for (const skill of skills) {
      if (!skill.description) continue;
      const hit = cache[skillTranslationKey(skill.id, skill.description)];
      if (hit) map[skill.id] = hit;
    }
    if (Object.keys(map).length > 0) {
      setTranslations(map);
      setTranslated(true);
    }
  }, [skills, locale]);

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(SKILL_CATEGORY_IDS.map((id) => [id, 0])) as Record<SkillCategoryId, number>;
    for (const skill of skills) counts[categorizeSkill(skill)] += 1;
    return counts;
  }, [skills]);

  const visibleSkills = useMemo(
    () => filterSkills(skills, { query, category, extraText: translations }),
    [skills, query, category, translations]
  );

  const handleTranslate = useCallback(async () => {
    if (translated) {
      setTranslated(false);
      return;
    }

    const toTranslate = skills
      .filter((s) => s.description && !translations[s.id])
      .map((s) => ({ id: s.id, text: s.description! }));

    if (toTranslate.length === 0) {
      setTranslated(Object.keys(translations).length > 0);
      return;
    }

    setTranslating(true);
    try {
      const targetLang = LOCALE_LABELS[locale] || locale;
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: toTranslate.map((t) => t.text),
          targetLanguage: targetLang,
        }),
      });

      if (!res.ok) {
        console.error("Translation failed:", await res.text());
        return;
      }

      const { translations: results } = await res.json();
      const map: Record<string, string> = { ...translations };
      const cacheEntries: Record<string, string> = {};
      toTranslate.forEach((item, idx) => {
        const text = results[idx] || item.text;
        map[item.id] = text;
        if (results[idx]) cacheEntries[skillTranslationKey(item.id, item.text)] = results[idx];
      });
      writeSkillTranslationCache(locale, cacheEntries);
      setTranslations(map);
      setTranslated(true);
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setTranslating(false);
    }
  }, [skills, locale, translated, translations]);

  if (skills.length === 0) {
    return null;
  }

  return (
    <div>
      {/* Search + category filter + translate button */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {t("filteredCount", { shown: visibleSkills.length, total: skills.length })}
        </span>
        <div className="flex-1" />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleTranslate}
                disabled={translating}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-3 py-1.5 text-xs cursor-pointer hover:bg-muted hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label={t("categoryLabel")}>
        {(["all", ...SKILL_CATEGORY_IDS] as const)
          .filter((id) => id === "all" || categoryCounts[id] > 0)
          .map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={category === id}
              onClick={() => setCategory(id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                category === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 hover:border-primary/40 hover:bg-muted"
              }`}
            >
              {t(`categories.${id}`)}
              <span className="ml-1 opacity-70">{id === "all" ? skills.length : categoryCounts[id]}</span>
            </button>
          ))}
      </div>

      {visibleSkills.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("noMatchingSkillsFound")}</p>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleSkills.map((skill) => (
          <Card
            key={skill.id}
            className={`group relative cursor-pointer overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 ${!skill.isEnabled ? "opacity-60" : ""}`}
          >
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <CardHeader className="relative pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors duration-300 group-hover:bg-primary/20">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  {/* Name + slug */}
                  <div>
                    <CardTitle className="text-base font-semibold transition-colors duration-300 group-hover:text-primary">
                      {skill.name}
                    </CardTitle>
                    <Badge variant="secondary" className="mt-1 font-mono text-[10px]">
                      /{skill.slug}
                    </Badge>
                  </div>
                </div>

                {/* Action buttons - visible on hover */}
                <div className="flex items-center gap-0.5 opacity-0 transition-all duration-200 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEdit(skill)}
                    title={t("edit")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleExport(skill)}
                    title={t("export")}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDelete(skill)}
                    title={t("delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Description */}
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {translated && translations[skill.id]
                  ? translations[skill.id]
                  : skill.description || "—"}
              </p>
            </CardHeader>

            <CardContent className="relative">
              <div className="flex items-center justify-between text-xs">
                {/* Scope badge */}
                <Badge variant={skill.workspaceId ? "outline" : "default"} className="text-[10px]">
                  {skill.workspaceId ? t("workspace") : t("global")}
                </Badge>

                {/* Enabled/disabled toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleEnabled(skill);
                  }}
                  className="inline-flex items-center gap-1 text-xs cursor-pointer hover:opacity-80 transition-opacity"
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
