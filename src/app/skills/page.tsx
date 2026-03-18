"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageBackground } from "@/components/ui/page-background";
import { Plus, Download, Sparkles, Zap, Brain, Code2 } from "lucide-react";
import { toast } from "sonner";
import { useSkills } from "@/lib/hooks/use-skills";
import { useMounted } from "@/lib/hooks/use-mounted";
import { SkillList } from "@/components/skills/skill-list";
import { SkillMdFormDialog } from "@/components/skills/skill-md-form-dialog";
import { SkillImportDialog } from "@/components/skills/skill-import-dialog";
import type { Skill, SkillStep, SkillParameter } from "@/types";

const FEATURES = [
  { icon: Zap, label: "Automation", color: "from-amber-500 to-orange-500" },
  { icon: Code2, label: "Custom Workflows", color: "from-blue-500 to-cyan-500" },
  { icon: Brain, label: "AI-Powered", color: "from-violet-500 to-purple-500" },
] as const;

export default function SkillsPage() {
  const t = useTranslations("skills");
  const { skills, isLoading, mutate } = useSkills(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const mounted = useMounted();

  const handleCreate = () => {
    setEditingSkill(null);
    setFormOpen(true);
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setFormOpen(true);
  };

  const handleSave = async (data: {
    name: string;
    slug: string;
    description: string;
    systemPrompt: string;
    workspaceId: string | null;
    steps: SkillStep[] | null;
    allowedTools: string[] | null;
    parameters: SkillParameter[] | null;
  }) => {
    if (editingSkill) {
      const res = await fetch(`/api/skills/${editingSkill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update skill");
      }
      toast.success(t("edit"));
    } else {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create skill");
      }
      toast.success(t("create"));
    }
    mutate();
  };

  const handleDelete = async (skill: Skill) => {
    if (!confirm(t("deleteConfirm", { name: skill.name }))) return;
    try {
      const res = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });
      if (!res.ok) {
        let message = "Failed to delete skill";
        try {
          const err = await res.json();
          if (err && typeof err.error === "string") {
            message = err.error;
          }
        } catch {
          // ignore JSON parse errors and use default message
        }
        toast.error(message);
        return;
      }
      mutate();
    } catch {
      toast.error("Failed to delete skill");
    }
  };

  const handleToggleEnabled = async (skill: Skill) => {
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !skill.isEnabled }),
      });

      if (!res.ok) {
        let message = "Failed to update skill state";
        try {
          const err = await res.json();
          if (err && typeof err.error === "string") {
            message = err.error;
          }
        } catch {
          // Ignore JSON parsing errors and fall back to default message
        }
        toast.error(message);
        return;
      }

      mutate();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update skill state");
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <ScrollArea className="flex-1">
        <main className="relative min-h-full overflow-hidden">
          <PageBackground isActive={mounted} />

          <div className="relative mx-auto max-w-7xl px-4 py-12">
            {/* Hero Section */}
            <div className="mb-16 text-center">
              {/* Animated badge */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm animate-slide-in-up">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span>Skills Management</span>
              </div>

              {/* Main title with glow effect */}
              <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                <span className="inline-block animate-slide-in-up bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                  {t("title")}
                </span>
              </h1>

              <p className="mx-auto max-w-2xl text-lg text-muted-foreground animate-slide-in-up [animation-delay:200ms]">
                {t("subtitle")}
              </p>

              {/* Feature pills */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 animate-slide-in-up [animation-delay:300ms]">
                {FEATURES.map((feature, i) => (
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
              <Button
                variant="outline"
                size="lg"
                className="gap-2 group border-border/50 hover:border-primary/50 transition-all"
                onClick={() => setImportOpen(true)}
              >
                <Download className="h-4 w-4 transition-transform group-hover:scale-110" />
                {t("import")}
              </Button>
              <Button
                size="lg"
                className="gap-2 group cyber-btn text-white"
                onClick={handleCreate}
              >
                <Plus className="h-4 w-4 transition-transform group-hover:scale-110" />
                {t("create")}
              </Button>
            </div>

            {/* Skills Section Header */}
            <div className="mb-6 animate-slide-in-up [animation-delay:600ms]">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">{t("title")}</h2>
                {skills.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {skills.length}
                  </span>
                )}
              </div>
            </div>

            {/* Content: Loading / Empty / List */}
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-40 animate-shimmer rounded-xl border border-border/50"
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            ) : skills.length === 0 ? (
              <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border/50 bg-gradient-to-b from-muted/20 to-transparent py-20 text-center backdrop-blur-sm animate-slide-in-up [animation-delay:700ms]">
                {/* Decorative elements */}
                <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-accent/5 blur-3xl" />

                <div className="relative mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-6 animate-glow-pulse">
                  <Zap className="h-12 w-12 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{t("noSkills")}</h3>
                <p className="mb-8 max-w-md text-muted-foreground">
                  {t("noSkillsDesc")}
                </p>
                <Button size="lg" className="gap-2 cyber-btn text-white" onClick={handleCreate}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t("create")}
                </Button>
              </div>
            ) : (
              <div className="animate-slide-in-up [animation-delay:700ms]">
                <SkillList
                  skills={skills}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleEnabled={handleToggleEnabled}
                />
              </div>
            )}
          </div>
        </main>
      </ScrollArea>

      <SkillMdFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        skill={editingSkill}
        onSave={handleSave}
      />

      <SkillImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={mutate}
      />
    </div>
  );
}
