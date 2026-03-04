"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { useSkills } from "@/lib/hooks/use-skills";
import { SkillList } from "@/components/skills/skill-list";
import { SkillFormDialog } from "@/components/skills/skill-form-dialog";
import { SkillImportDialog } from "@/components/skills/skill-import-dialog";
import type { Skill, SkillStep, SkillParameter } from "@/types";

export default function SkillsPage() {
  const t = useTranslations("skills");
  const { skills, mutate } = useSkills(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              {t("import")}
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t("create")}
            </Button>
          </div>
        </div>

        <SkillList
          skills={skills}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleEnabled={handleToggleEnabled}
        />

        <SkillFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          skill={editingSkill}
          onSave={handleSave}
        />

        <SkillImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => mutate()}
        />
      </main>
    </div>
  );
}
