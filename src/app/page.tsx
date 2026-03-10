"use client";

import { useEffect, useState, useMemo, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { FolderOpen, GitBranch, Sparkles, Cpu, Zap, Brain, Code2, GraduationCap, Server } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { WorkspaceList } from "@/components/workspaces/workspace-list";
import { OpenWorkspaceDialog } from "@/components/workspaces/open-workspace-dialog";
import { CloneRepoDialog } from "@/components/git/clone-repo-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import { toast } from "sonner";
import { ParticleEffect, FloatingOrbs } from "@/components/ui/particle-effect";

export default function HomePage() {
  const t = useTranslations("home");
  const { workspaces, isLoading, mutate } = useWorkspaces();
  const [workspaceRoots, setWorkspaceRoots] = useState<string[]>([]);
  const mounted = useSyncExternalStore(
    (cb) => { cb(); return () => {}; },
    () => true,
    () => false,
  );

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

  // Feature cards data
  const features = useMemo(() => [
    { icon: Brain, label: "AI Agent", color: "from-violet-500 to-purple-500" },
    { icon: Code2, label: "Code Analysis", color: "from-blue-500 to-cyan-500" },
    { icon: Zap, label: "Fast Search", color: "from-amber-500 to-orange-500" },
  ], []);

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <ScrollArea className="flex-1">
        <main className="relative min-h-full overflow-hidden">
          {/* Background effects */}
          <div className="pointer-events-none absolute inset-0">
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
              style={{
                backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)`,
                backgroundSize: '60px 60px',
              }}
            />
            {/* Radial gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
            {/* Floating orbs */}
            <FloatingOrbs isActive={mounted} />
            {/* Particle effect */}
            <ParticleEffect isActive={mounted} particleCount={30} />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 py-12">
            {/* Hero Section */}
            <div className="mb-16 text-center">
              {/* Animated badge */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm animate-slide-in-up">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span>AI-Powered Research Assistant</span>
              </div>

              {/* Main title with glow effect */}
              <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                <span className="inline-block animate-slide-in-up bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                  Welcome to{" "}
                </span>
                <span>{" "}</span>
                <span className="relative inline-block animate-slide-in-up [animation-delay:100ms]">
                  <span className="relative z-10 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-rotate_3s_linear_infinite]">
                    InnoClaw
                  </span>
                  {/* Glow behind text */}
                  <span className="absolute inset-0 -z-10 blur-2xl opacity-50 bg-gradient-to-r from-primary to-accent" />
                </span>
              </h1>

              <p className="mx-auto max-w-2xl text-lg text-muted-foreground animate-slide-in-up [animation-delay:200ms]">
                {t("subtitle") || "Your intelligent workspace for research, coding, and knowledge management"}
              </p>

              {/* Feature pills */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 animate-slide-in-up [animation-delay:300ms]">
                {features.map((feature, i) => (
                  <div
                    key={feature.label}
                    className="group flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/5"
                    style={{ animationDelay: `${400 + i * 100}ms` }}
                  >
                    <div className={`rounded-full bg-gradient-to-r ${feature.color} p-1.5`}>
                      <feature.icon className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {feature.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mb-12 flex flex-wrap items-center justify-center gap-4 animate-slide-in-up [animation-delay:500ms]">
              <CloneRepoDialog
                trigger={
                  <Button variant="outline" size="lg" className="gap-2 group border-border/50 hover:border-primary/50 transition-all">
                    <GitBranch className="h-4 w-4 transition-transform group-hover:scale-110" />
                    {t("cloneFromGithub")}
                  </Button>
                }
              />
              <OpenWorkspaceDialog
                workspaceRoots={workspaceRoots}
                trigger={
                  <Button size="lg" className="gap-2 group cyber-btn text-white">
                    <FolderOpen className="h-4 w-4 transition-transform group-hover:scale-110" />
                    {t("openWorkspace")}
                  </Button>
                }
              />
              <Link href="/paper">
                <Button variant="outline" size="lg" className="gap-2 group border-border/50 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all">
                  <GraduationCap className="h-4 w-4 transition-transform group-hover:scale-110 text-purple-500" />
                  <span>Paper Study</span>
                </Button>
              </Link>
              <Link href="/cluster">
                <Button variant="outline" size="lg" className="gap-2 group border-border/50 hover:border-green-500/50 hover:bg-green-500/5 transition-all">
                  <Server className="h-4 w-4 transition-transform group-hover:scale-110 text-green-500" />
                  <span>Cluster</span>
                </Button>
              </Link>
            </div>

            {/* Workspace Section */}
            <div className="mb-6 animate-slide-in-up [animation-delay:600ms]">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Cpu className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">{t("title")}</h2>
                {workspaces.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {workspaces.length}
                  </span>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-32 animate-shimmer rounded-xl border border-border/50"
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            ) : workspaces.length === 0 ? (
              <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border/50 bg-gradient-to-b from-muted/20 to-transparent py-20 text-center backdrop-blur-sm animate-slide-in-up [animation-delay:700ms]">
                {/* Decorative elements */}
                <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-accent/5 blur-3xl" />

                <div className="relative mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-6 animate-glow-pulse">
                  <FolderOpen className="h-12 w-12 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{t("noWorkspaces") || "No workspaces yet"}</h3>
                <p className="mb-8 max-w-md text-muted-foreground">
                  {t("noWorkspacesDesc") || "Create or open a workspace to get started with InnoClaw"}
                </p>
                <OpenWorkspaceDialog
                  workspaceRoots={workspaceRoots}
                  trigger={
                    <Button size="lg" className="gap-2 cyber-btn text-white">
                      <FolderOpen className="mr-1 h-4 w-4" />
                      {t("openWorkspace")}
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="animate-slide-in-up [animation-delay:700ms]">
                <WorkspaceList workspaces={workspaces} onDelete={handleDelete} />
              </div>
            )}
          </div>
        </main>
      </ScrollArea>
    </div>
  );
}
