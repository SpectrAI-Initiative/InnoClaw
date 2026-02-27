"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { SkillStep } from "@/types";

const TOOL_OPTIONS = ["bash", "readFile", "writeFile", "listDirectory", "grep"];

interface SkillStepsEditorProps {
  steps: SkillStep[];
  onChange: (steps: SkillStep[]) => void;
}

export function SkillStepsEditor({ steps, onChange }: SkillStepsEditorProps) {
  const t = useTranslations("skills");

  const addStep = () => {
    onChange([
      ...steps,
      { order: steps.length + 1, instruction: "" },
    ]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, order: i + 1 }));
    onChange(newSteps);
  };

  const updateStep = (index: number, updates: Partial<SkillStep>) => {
    const newSteps = steps.map((s, i) =>
      i === index ? { ...s, ...updates } : s
    );
    onChange(newSteps);
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={step.order} className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm text-muted-foreground w-6 shrink-0">
            {step.order}
          </span>
          <Input
            value={step.instruction}
            onChange={(e) =>
              updateStep(index, { instruction: e.target.value })
            }
            placeholder={t("stepInstruction")}
            className="flex-1"
          />
          <Select
            value={step.toolHint || "_none"}
            onValueChange={(v) =>
              updateStep(index, {
                toolHint: v === "_none" ? undefined : v,
              })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t("stepToolHint")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">-</SelectItem>
              {TOOL_OPTIONS.map((tool) => (
                <SelectItem key={tool} value={tool}>
                  {tool}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeStep(index)}
            className="shrink-0"
            aria-label={t("deleteStep")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addStep}>
        <Plus className="h-4 w-4 mr-1" />
        {t("addStep")}
      </Button>
    </div>
  );
}
