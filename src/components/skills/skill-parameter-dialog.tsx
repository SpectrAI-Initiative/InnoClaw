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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Skill } from "@/types";

interface SkillParameterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: Skill;
  onSubmit: (paramValues: Record<string, string>) => void;
}

export function SkillParameterDialog({
  open,
  onOpenChange,
  skill,
  onSubmit,
}: SkillParameterDialogProps) {
  const t = useTranslations("skills");
  const tc = useTranslations("common");
  const params = skill.parameters || [];

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of params) {
      init[p.name] = p.defaultValue || "";
    }
    return init;
  });

  // Reset values when the skill changes or dialog reopens
  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      for (const p of params) {
        init[p.name] = p.defaultValue || "";
      }
      setValues(init);
    }
  }, [skill.id, open, skill.parameters?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const canSubmit = params
    .filter((p) => p.required)
    .every((p) => values[p.name]?.trim());

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("fillParameters", { name: skill.name })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {params.map((param) => (
            <div key={param.name} className="space-y-1.5">
              <Label>
                {param.label || param.name}
                {param.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </Label>

              {param.type === "string" && (
                <Input
                  value={values[param.name] || ""}
                  onChange={(e) => setValue(param.name, e.target.value)}
                  placeholder={param.placeholder}
                />
              )}

              {param.type === "number" && (
                <Input
                  type="number"
                  value={values[param.name] || ""}
                  onChange={(e) => setValue(param.name, e.target.value)}
                  placeholder={param.placeholder}
                />
              )}

              {param.type === "boolean" && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`bool-${param.name}`}
                    checked={values[param.name] === "true"}
                    onCheckedChange={(checked) =>
                      setValue(param.name, checked ? "true" : "false")
                    }
                  />
                  <label htmlFor={`bool-${param.name}`} className="text-sm text-muted-foreground">
                    {param.placeholder || param.label}
                  </label>
                </div>
              )}

              {param.type === "select" && param.options && (
                <Select
                  value={values[param.name] || ""}
                  onValueChange={(v) => setValue(param.name, v)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={param.placeholder || param.label}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {param.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {t("runSkill")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
