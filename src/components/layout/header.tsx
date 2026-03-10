"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bot, Settings, Zap, FolderOpen, Minimize2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps {
  onToggleMinimalMode?: () => void;
  showMinimalToggle?: boolean;
}

export function Header({ onToggleMinimalMode, showMinimalToggle }: HeaderProps) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();

  // Extract workspaceId from URL like /workspace/xxx
  const workspaceMatch = pathname.match(/^\/workspace\/([^/]+)/);
  const workspaceId = workspaceMatch?.[1] ?? null;

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 w-full items-center px-4">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5 font-semibold">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 transition-all duration-300 group-hover:from-primary/30 group-hover:to-accent/30">
              <Bot className="h-4.5 w-4.5 text-primary transition-transform duration-300 group-hover:scale-110" />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-accent opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-30" />
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent transition-all duration-300 group-hover:from-primary group-hover:to-accent">
              InnoClaw
            </span>
          </Link>

          <div className="flex-1" />

          {/* Navigation */}
          <nav className="flex items-center gap-1.5">
            {showMinimalToggle && onToggleMinimalMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                    onClick={onToggleMinimalMode}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-card border-border/50">
                  {t("minimalMode")}
                </TooltipContent>
              </Tooltip>
            )}

            {workspaceId && pathname !== `/workspace/${workspaceId}` && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={`/workspace/${workspaceId}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-card border-border/50">
                  {t("workspace")}
                </TooltipContent>
              </Tooltip>
            )}

            <LanguageToggle />
            <ThemeToggle />

            <div className="mx-1 h-5 w-px bg-border/50" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/datasets">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary ${
                      pathname === "/datasets" ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <Database className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-card border-border/50">
                {t("datasets")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/skills">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 rounded-lg transition-all duration-200 hover:bg-accent/10 hover:text-accent ${
                      pathname === "/skills" ? "bg-accent/10 text-accent" : ""
                    }`}
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-card border-border/50">
                {t("skills")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                {pathname === "/settings" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg bg-primary/10 text-primary"
                    onClick={() => router.back()}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                ) : (
                  <Link href="/settings">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg transition-all duration-200 hover:bg-muted hover:text-foreground"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-card border-border/50">
                {t("settings")}
              </TooltipContent>
            </Tooltip>
          </nav>
        </div>
      </header>
    </TooltipProvider>
  );
}
