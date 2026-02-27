"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpen, Settings, Zap } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";

export function Header() {
  const t = useTranslations("common");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 w-full items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5" />
          <span>NotebookLM</span>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Link
            href="/skills"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
          >
            <Zap className="h-4 w-4" />
            <span className="sr-only">{t("skills")}</span>
          </Link>
          <Link
            href="/settings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">{t("settings")}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
