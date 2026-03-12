"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eye, Code2, AlertCircle, AlertTriangle } from "lucide-react";
import type { Skill, SkillStep, SkillParameter } from "@/types";
import { skillToMarkdown, markdownToSkillData, getDefaultSkillTemplate } from "@/lib/utils/skill-md";

interface SkillMdFormDialogProps {
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

export function SkillMdFormDialog({
  open,
  onOpenChange,
  skill,
  workspaceId,
  onSave,
}: SkillMdFormDialogProps) {
  const t = useTranslations("skills");
  const tc = useTranslations("common");

  const [markdown, setMarkdown] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Memoize parsed result to avoid re-parsing during render
  const parsed = useMemo(() => markdownToSkillData(markdown), [markdown]);

  // Initialize markdown content
  useEffect(() => {
    if (skill) {
      setMarkdown(skillToMarkdown(skill));
    } else {
      setMarkdown(getDefaultSkillTemplate());
    }
    setParseError(null);
    setShowPreview(false);
  }, [skill, open]);

  // Validate on change
  const handleChange = useCallback((value: string) => {
    setMarkdown(value);
    const result = markdownToSkillData(value);
    if (!result) {
      setParseError(t("mdParseError"));
    } else if (!result.name) {
      setParseError(t("mdMissingName"));
    } else if (!result.systemPrompt) {
      setParseError(t("mdMissingPrompt"));
    } else if (!workspaceId && !result.isGlobal) {
      setParseError(t("mdScopeError"));
    } else {
      setParseError(null);
    }
  }, [t, workspaceId]);

  const handleSubmit = async () => {
    if (!parsed || !parsed.name || !parsed.systemPrompt) {
      toast.error(parseError || t("mdParseError"));
      return;
    }

    // Disallow workspace scope without workspaceId
    if (!parsed.isGlobal && !workspaceId) {
      toast.error(t("mdScopeError"));
      return;
    }

    const slug = parsed.slug || parsed.name;

    setSaving(true);
    try {
      await onSave({
        name: parsed.name,
        slug,
        description: parsed.description,
        systemPrompt: parsed.systemPrompt,
        workspaceId: parsed.isGlobal ? null : workspaceId || null,
        steps: parsed.steps,
        allowedTools: parsed.allowedTools,
        parameters: parsed.parameters,
      });
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save skill";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>
              {skill ? t("edit") : t("create")}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-1.5"
            >
              {showPreview ? (
                <>
                  <Code2 className="h-3.5 w-3.5" />
                  {tc("edit")}
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  {tc("preview")}
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          {showPreview ? (
            <div className="space-y-4 p-1">
              {parsed ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">
                        {parsed.name || <span className="text-muted-foreground italic">{t("mdNoName")}</span>}
                      </h3>
                      {parsed.slug && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          /{parsed.slug}
                        </Badge>
                      )}
                      <Badge variant={parsed.isGlobal ? "default" : "outline"}>
                        {parsed.isGlobal ? t("global") : t("workspace")}
                      </Badge>
                    </div>
                    {parsed.description && (
                      <p className="text-sm text-muted-foreground">
                        {parsed.description}
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <h4 className="text-sm font-medium">{t("systemPrompt")}</h4>
                    <pre className="text-xs bg-muted rounded-md p-3 whitespace-pre-wrap max-h-[200px] overflow-auto">
                      {parsed.systemPrompt || <span className="text-muted-foreground italic">{t("mdNoPrompt")}</span>}
                    </pre>
                  </div>

                  {parsed.steps && parsed.steps.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-medium">
                          {t("steps")} ({parsed.steps.length})
                        </h4>
                        <div className="space-y-1">
                          {parsed.steps.map((step, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground w-5 text-right shrink-0">
                                {step.order}.
                              </span>
                              <span>{step.instruction}</span>
                              {step.toolHint && (
                                <Badge variant="outline" className="font-mono text-xs">
                                  {step.toolHint}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {parsed.allowedTools && parsed.allowedTools.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-medium">{t("toolPermissions")}</h4>
                        <div className="flex flex-wrap gap-1">
                          {parsed.allowedTools.map((tool) => (
                            <Badge key={tool} variant="outline" className="font-mono text-xs">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {parsed.parameters && parsed.parameters.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-medium">
                          {t("parameters")} ({parsed.parameters.length})
                        </h4>
                        <div className="space-y-1">
                          {parsed.parameters.map((param, i) => (
                            <div key={i} className="text-sm flex items-center gap-2">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {`{{${param.name}}}`}
                              </Badge>
                              <span>{param.label}</span>
                              <span className="text-muted-foreground">({param.type})</span>
                              {param.required && (
                                <span className="text-destructive text-xs">*</span>
                              )}
                              {param.defaultValue && (
                                <span className="text-muted-foreground text-xs">
                                  = {param.defaultValue}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-destructive text-sm py-4">
                  <AlertCircle className="h-4 w-4" />
                  {t("mdParseError")}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 p-1">
              <p className="text-xs text-muted-foreground">
                {t("mdEditorDesc")}
              </p>
              <Textarea
                value={markdown}
                onChange={(e) => handleChange(e.target.value)}
                className="min-h-[400px] font-mono text-sm leading-relaxed resize-y"
                placeholder={getDefaultSkillTemplate()}
              />
              {parseError && (
                <div className="flex items-center gap-1.5 text-destructive text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {parseError}
                </div>
              )}
              {!parseError && parsed?.warnings && parsed.warnings.length > 0 && (
                <div className="space-y-1">
                  {parsed.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-500 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!!parseError || !parsed?.name || !parsed?.systemPrompt || saving}
          >
            {saving ? tc("loading") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
