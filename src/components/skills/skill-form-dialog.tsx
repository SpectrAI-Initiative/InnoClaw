"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SkillStepsEditor } from "./skill-steps-editor";
import { SkillParametersEditor } from "./skill-parameters-editor";
import type { Skill, SkillStep, SkillParameter } from "@/types";

const ALL_TOOLS = ["bash", "readFile", "writeFile", "listDirectory", "grep"];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface SkillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill?: Skill | null;
  workspaceId?: string | null;
  onSave: (data: {
    name: string;
    slug: string;
    description: string;
    systemPrompt: string;
    workspaceId: string | null;
    steps: SkillStep[] | null;
    allowedTools: string[] | null;
    parameters: SkillParameter[] | null;
  }) => Promise<void>;
}

export function SkillFormDialog({
  open,
  onOpenChange,
  skill,
  workspaceId,
  onSave,
}: SkillFormDialogProps) {
  const t = useTranslations("skills");
  const tc = useTranslations("common");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isGlobal, setIsGlobal] = useState(true);
  const [steps, setSteps] = useState<SkillStep[]>([]);
  const [allToolsEnabled, setAllToolsEnabled] = useState(true);
  const [selectedTools, setSelectedTools] = useState<string[]>([...ALL_TOOLS]);
  const [parameters, setParameters] = useState<SkillParameter[]>([]);
  const [saving, setSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (skill) {
      setName(skill.name);
      setSlug(skill.slug);
      setSlugManual(true);
      setDescription(skill.description || "");
      setSystemPrompt(skill.systemPrompt);
      setIsGlobal(!skill.workspaceId);
      setSteps(skill.steps || []);
      if (skill.allowedTools && skill.allowedTools.length > 0) {
        setAllToolsEnabled(false);
        setSelectedTools(skill.allowedTools);
      } else {
        setAllToolsEnabled(true);
        setSelectedTools([...ALL_TOOLS]);
      }
      setParameters(skill.parameters || []);
    } else {
      setName("");
      setSlug("");
      setSlugManual(false);
      setDescription("");
      setSystemPrompt("");
      setIsGlobal(!workspaceId);
      setSteps([]);
      setAllToolsEnabled(true);
      setSelectedTools([...ALL_TOOLS]);
      setParameters([]);
    }
  }, [skill, open, workspaceId]);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManual && name) {
      setSlug(slugify(name));
    }
  }, [name, slugManual]);

  const handleSubmit = async () => {
    if (!name || !slug || !systemPrompt) return;
    setSaving(true);
    try {
      await onSave({
        name,
        slug,
        description,
        systemPrompt,
        workspaceId: isGlobal ? null : workspaceId || null,
        steps: steps.length > 0 ? steps : null,
        allowedTools: allToolsEnabled ? null : selectedTools,
        parameters: parameters.length > 0 ? parameters : null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {skill ? t("edit") : t("create")}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Basic Info */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("name")}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("slug")}</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-sm">/</span>
                    <Input
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value);
                        setSlugManual(true);
                      }}
                      placeholder={t("slugPlaceholder")}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("description")}</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("scope")}</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={isGlobal}
                      onChange={() => setIsGlobal(true)}
                      className="accent-primary"
                    />
                    {t("scopeGlobal")}
                  </label>
                  {workspaceId && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={!isGlobal}
                        onChange={() => setIsGlobal(false)}
                        className="accent-primary"
                      />
                      {t("scopeWorkspace")}
                    </label>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* System Prompt */}
            <div className="space-y-1.5">
              <Label>{t("systemPrompt")}</Label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={t("systemPromptPlaceholder")}
                className="min-h-[120px] font-mono text-sm"
              />
            </div>

            <Separator />

            {/* Steps */}
            <div className="space-y-1.5">
              <Label>{t("steps")}</Label>
              <p className="text-xs text-muted-foreground">{t("stepsDesc")}</p>
              <SkillStepsEditor steps={steps} onChange={setSteps} />
            </div>

            <Separator />

            {/* Tool Permissions */}
            <div className="space-y-2">
              <Label>{t("toolPermissions")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("toolPermissionsDesc")}
              </p>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="all-tools"
                  checked={allToolsEnabled}
                  onCheckedChange={(checked) => {
                    setAllToolsEnabled(!!checked);
                    if (checked) setSelectedTools([...ALL_TOOLS]);
                  }}
                />
                <label htmlFor="all-tools" className="text-sm">
                  {t("allTools")}
                </label>
              </div>
              {!allToolsEnabled && (
                <div className="grid grid-cols-3 gap-2">
                  {ALL_TOOLS.map((tool) => (
                    <div key={tool} className="flex items-center gap-2">
                      <Checkbox
                        id={`tool-${tool}`}
                        checked={selectedTools.includes(tool)}
                        onCheckedChange={() => toggleTool(tool)}
                      />
                      <label
                        htmlFor={`tool-${tool}`}
                        className="text-sm font-mono"
                      >
                        {tool}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Parameters */}
            <div className="space-y-1.5">
              <Label>{t("parameters")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("parametersDesc")}
              </p>
              <SkillParametersEditor
                parameters={parameters}
                onChange={setParameters}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name || !slug || !systemPrompt || saving}
          >
            {saving ? tc("loading") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
