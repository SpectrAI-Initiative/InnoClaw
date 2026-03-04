"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { SkillParameter } from "@/types";

const PARAM_TYPES = ["string", "number", "boolean", "select"] as const;

interface SkillParametersEditorProps {
  parameters: SkillParameter[];
  onChange: (parameters: SkillParameter[]) => void;
}

export function SkillParametersEditor({
  parameters,
  onChange,
}: SkillParametersEditorProps) {
  const t = useTranslations("skills");

  const addParameter = () => {
    onChange([
      ...parameters,
      { name: "", label: "", type: "string", required: true },
    ]);
  };

  const removeParameter = (index: number) => {
    onChange(parameters.filter((_, i) => i !== index));
  };

  const updateParameter = (
    index: number,
    updates: Partial<SkillParameter>
  ) => {
    const newParams = parameters.map((p, i) =>
      i === index ? { ...p, ...updates } : p
    );
    onChange(newParams);
  };

  return (
    <div className="space-y-3">
      {parameters.map((param, index) => (
        <div
          key={index}
          className="rounded-md border p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Input
              value={param.name}
              onChange={(e) =>
                updateParameter(index, { name: e.target.value })
              }
              placeholder={t("paramName")}
              className="flex-1"
            />
            <Input
              value={param.label}
              onChange={(e) =>
                updateParameter(index, { label: e.target.value })
              }
              placeholder={t("paramLabel")}
              className="flex-1"
            />
            <Select
              value={param.type}
              onValueChange={(v) =>
                updateParameter(index, {
                  type: v as SkillParameter["type"],
                })
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARAM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeParameter(index)}
              className="shrink-0"
              aria-label={t("removeParameter")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`required-${index}`}
                checked={param.required}
                onCheckedChange={(checked) =>
                  updateParameter(index, { required: !!checked })
                }
              />
              <label htmlFor={`required-${index}`} className="text-sm">
                {t("paramRequired")}
              </label>
            </div>
            <Input
              value={param.defaultValue || ""}
              onChange={(e) =>
                updateParameter(index, {
                  defaultValue: e.target.value || undefined,
                })
              }
              placeholder={t("paramDefault")}
              className="flex-1"
            />
            {param.type === "select" && (
              <Input
                value={(param.options || []).join(", ")}
                onChange={(e) =>
                  updateParameter(index, {
                    options: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder={t("paramOptions")}
                className="flex-1"
              />
            )}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addParameter}>
        <Plus className="h-4 w-4 mr-1" />
        {t("addParameter")}
      </Button>
    </div>
  );
}
