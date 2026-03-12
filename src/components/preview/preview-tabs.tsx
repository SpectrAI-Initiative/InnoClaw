"use client";

import { useTranslations } from "next-intl";
import { X, FileText, BookOpen, StickyNote } from "lucide-react";
import type { Article } from "@/lib/article-search/types";

export interface PreviewTab {
  id: string;
  type: "file" | "article";
  label: string;
  filePath?: string;
  article?: Article;
}

interface PreviewTabsProps {
  tabs: PreviewTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function PreviewTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
}: PreviewTabsProps) {
  const t = useTranslations("preview");

  return (
    <div className="flex items-center gap-0.5 border-b border-border/50 bg-muted/30 px-1 py-0.5 shrink-0 overflow-x-auto">
      {/* Pinned Notes tab */}
      <div
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs cursor-pointer select-none transition-colors ${
          activeTabId === "notes"
            ? "bg-background text-foreground shadow-sm border border-border/50"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
        }`}
        onClick={() => onSelect("notes")}
      >
        <StickyNote className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span>{t("notes")}</span>
      </div>

      {/* Dynamic tabs */}
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const Icon = tab.type === "article" ? BookOpen : FileText;

        return (
          <div
            key={tab.id}
            className={`group flex items-center gap-1 rounded-md px-2.5 py-1 text-xs cursor-pointer select-none transition-colors ${
              isActive
                ? "bg-background text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
            onClick={() => onSelect(tab.id)}
          >
            <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="max-w-[120px] truncate">{tab.label}</span>
            <button
              className="ml-0.5 rounded p-0.5 transition-colors opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
