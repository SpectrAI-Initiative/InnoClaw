"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkillList } from "@/components/skills/skill-list";
import { SkillMdFormDialog } from "@/components/skills/skill-md-form-dialog";
import { SkillImportDialog } from "@/components/skills/skill-import-dialog";
import { SkillClawHubImportDialog } from "@/components/skills/skill-clawhub-import-dialog";
import { useSkills } from "@/lib/hooks/use-skills";
import type { Skill, SkillParameter, SkillStep } from "@/types";

export function SkillsView({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("skills");
  const tCommon = useTranslations("common");
  const { skills, isLoading, mutate } = useSkills(workspaceId);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [clawHubOpen, setClawHubOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

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
    const res = await fetch(editingSkill ? `/api/skills/${editingSkill.id}` : "/api/skills", {
      method: editingSkill ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || t("create"));
    }
    toast.success(tCommon("success"));
    mutate();
  };

  const handleDelete = async (skill: Skill) => {
    if (!confirm(t("deleteConfirm", { name: skill.name }))) return;
    const res = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(typeof err.error === "string" ? err.error : t("delete"));
      return;
    }
    toast.success(tCommon("success"));
    mutate();
  };

  const handleToggleEnabled = async (skill: Skill) => {
    const res = await fetch(`/api/skills/${skill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !skill.isEnabled }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(typeof err.error === "string" ? err.error : t("edit"));
      return;
    }
    mutate();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e7e7e8] px-6 py-3">
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>{t("import")}</Button>
        <Button variant="outline" size="sm" onClick={() => setClawHubOpen(true)}>{t("clawHubImport")}</Button>
        <Button size="sm" onClick={() => { setEditingSkill(null); setFormOpen(true); }}>{t("create")}</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-[#8A8A92]">{tCommon("loading")}</p>
        ) : (
          <SkillList
            skills={skills}
            onEdit={(skill) => { setEditingSkill(skill); setFormOpen(true); }}
            onDelete={handleDelete}
            onToggleEnabled={handleToggleEnabled}
          />
        )}
      </div>
      <SkillMdFormDialog open={formOpen} onOpenChange={setFormOpen} skill={editingSkill} onSave={handleSave} />
      <SkillImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={mutate} />
      <SkillClawHubImportDialog open={clawHubOpen} onOpenChange={setClawHubOpen} onImported={mutate} />
    </div>
  );
}
