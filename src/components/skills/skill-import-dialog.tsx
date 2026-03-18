"use client";

import React, { useState, useRef } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, FileUp, FolderOpen, Sparkles, CheckCircle2 } from "lucide-react";
import { markdownToSkillData } from "@/lib/utils/skill-md";

interface SkillImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string | null;
  onImported: () => void;
}

interface BatchResult {
  imported: number;
  failed: number;
}

/** Returns the fallback slug and whether the relative path matches an importable pattern */
function getImportableSlug(relativePath: string): string | null {
  // */skills/*/SKILL.md
  const skillMatch = relativePath.match(/(?:^|\/)skills\/([^/]+)\/SKILL\.md$/);
  if (skillMatch) return skillMatch[1];

  // */commands/*.md
  const cmdMatch = relativePath.match(/(?:^|\/)commands\/([^/]+)\.md$/);
  if (cmdMatch) return cmdMatch[1];

  // */agents/*.md but NOT inside skills/*/agents/
  if (
    /(?:^|\/)agents\/[^/]+\.md$/.test(relativePath) &&
    !/(?:^|\/)skills\/[^/]+\/agents\//.test(relativePath)
  ) {
    const agentSlug = relativePath.match(/(?:^|\/)agents\/([^/]+)\.md$/)?.[1];
    if (agentSlug) return agentSlug;
  }

  return null;
}

/** Helper to parse file content and fall back gracefully when no valid frontmatter exists */
function parseFileContent(
  content: string,
  fallbackSlug: string
): {
  name: string;
  slug: string;
  systemPrompt: string;
  description: string | null;
  steps: unknown | null;
  allowedTools: unknown | null;
  parameters: unknown | null;
} | null {
  const parsed = markdownToSkillData(content);
  if (parsed?.name && parsed.systemPrompt) {
    return {
      name: parsed.name,
      slug: parsed.slug || fallbackSlug,
      systemPrompt: parsed.systemPrompt,
      description: parsed.description || null,
      steps: parsed.steps ?? null,
      allowedTools: parsed.allowedTools ?? null,
      parameters: parsed.parameters ?? null,
    };
  }
  const systemPrompt = content.trim();
  if (!systemPrompt) return null;
  return {
    name: fallbackSlug,
    slug: fallbackSlug,
    systemPrompt,
    description: null,
    steps: null,
    allowedTools: null,
    parameters: null,
  };
}


export function SkillImportDialog({
  open,
  onOpenChange,
  workspaceId,
  onImported,
}: SkillImportDialogProps) {
  const t = useTranslations("skills");
  const tc = useTranslations("common");

  const [tab, setTab] = useState("url");
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  // Folder import state
  const [folderProgress, setFolderProgress] = useState<{ current: number; total: number } | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Single file import state
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Claude Code import state
  const [claudePath, setClaudePath] = useState("");

  const resetState = () => {
    setUrl("");
    setError(null);
    setImporting(false);
    setBatchResult(null);
    setFolderProgress(null);
    setClaudePath("");
  };

  const doImport = async (payload: {
    url?: string;
    skill?: unknown;
    workspaceId?: string | null;
  }) => {
    setImporting(true);
    setError(null);
    setBatchResult(null);
    try {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          workspaceId: workspaceId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || t("importError"));
        return;
      }
      const result = await res.json();

      // Check if this is a batch import result
      if (result.batch) {
        setBatchResult({ imported: result.imported, failed: result.failed });
        onImported();
        return result;
      }

      // Single skill imported
      onImported();
      onOpenChange(false);
      resetState();
      return result;
    } catch {
      setError(t("importError"));
    } finally {
      setImporting(false);
    }
  };

  const handleImportUrl = async () => {
    if (!url.trim()) return;
    await doImport({ url: url.trim() });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = markdownToSkillData(text);
      if (!parsed || !parsed.name || !parsed.systemPrompt) {
        setError(t("invalidMarkdown"));
        return;
      }
      await doImport({
        skill: {
          name: parsed.name,
          slug: parsed.slug,
          description: parsed.description || null,
          systemPrompt: parsed.systemPrompt,
          steps: parsed.steps,
          allowedTools: parsed.allowedTools,
          parameters: parsed.parameters,
        },
      });
    } catch {
      setError(t("invalidMarkdown"));
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Filter to importable files based on relative path patterns
    const importableFiles: Array<{ file: File; slug: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = (file as File & { webkitRelativePath: string }).webkitRelativePath || file.name;
      const slug = getImportableSlug(relativePath);
      if (slug) {
        importableFiles.push({ file, slug });
      }
    }

    if (importableFiles.length === 0) {
      setError(t("folderNoSkills"));
      if (folderInputRef.current) folderInputRef.current.value = "";
      return;
    }

    setImporting(true);
    setError(null);
    setBatchResult(null);
    setFolderProgress({ current: 0, total: importableFiles.length });

    let imported = 0;
    let failed = 0;

    for (let i = 0; i < importableFiles.length; i++) {
      const { file, slug } = importableFiles[i];
      setFolderProgress({ current: i + 1, total: importableFiles.length });

      try {
        const text = await file.text();
        const parsed = parseFileContent(text, slug);
        if (!parsed) {
          failed++;
          continue;
        }

        const res = await fetch("/api/skills/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skill: {
              name: parsed.name,
              slug: parsed.slug,
              description: parsed.description,
              systemPrompt: parsed.systemPrompt,
              steps: parsed.steps,
              allowedTools: parsed.allowedTools,
              parameters: parsed.parameters,
            },
            workspaceId: workspaceId || null,
          }),
        });

        if (res.ok) {
          imported++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setImporting(false);
    setFolderProgress(null);
    setBatchResult({ imported, failed });
    if (imported > 0) onImported();

    // Reset folder input
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const handleClaudeCodeImport = async () => {
    setImporting(true);
    setError(null);
    setBatchResult(null);
    try {
      const res = await fetch("/api/skills/claude-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claudePath: claudePath.trim() || undefined,
          workspaceId: workspaceId || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || t("importError"));
        return;
      }
      setBatchResult({ imported: result.imported, failed: result.failed });
      if (result.imported > 0) onImported();
      if (result.imported === 0 && result.failed === 0) {
        setError(t("claudeCodeNoSkills", { path: result.claudeDir }));
      }
    } catch {
      setError(t("importError"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetState();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("import")}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v); setBatchResult(null); setError(null); setFolderProgress(null); }}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="url" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              URL
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-1.5">
              <FileUp className="h-3.5 w-3.5" />
              {t("importFromFile")}
            </TabsTrigger>
            <TabsTrigger value="folder" className="gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              {t("importFromFolder")}
            </TabsTrigger>
            <TabsTrigger value="claude" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Claude
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              {t("importUrlDesc")}
            </p>
            <div className="space-y-1.5">
              <Label>{t("importUrl")}</Label>
              <Input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                  setBatchResult(null);
                }}
                placeholder={t("importUrlPlaceholder")}
              />
            </div>
          </TabsContent>

          <TabsContent value="file" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              {t("importFileDesc")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <FileUp className="h-4 w-4 mr-2" />
              {t("selectFile")}
            </Button>
          </TabsContent>

          <TabsContent value="folder" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              {t("importFolderDesc")}
            </p>
            <input
              ref={folderInputRef}
              type="file"
              // webkitdirectory is a widely-supported non-standard attribute for folder selection;
              // it is not included in React's InputHTMLAttributes typings
              // @ts-expect-error TS2322: webkitdirectory is valid HTML but not typed in React
              webkitdirectory=""
              multiple
              onChange={handleFolderSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
              disabled={importing}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {t("selectFolder")}
            </Button>
            {folderProgress && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  {t("folderProgress", { current: folderProgress.current, total: folderProgress.total })}
                </p>
                <Progress value={(folderProgress.current / folderProgress.total) * 100} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="claude" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              {t("claudeCodeDesc")}
            </p>
            <div className="space-y-1.5">
              <Label>{t("claudeCodePath")}</Label>
              <Input
                value={claudePath}
                onChange={(e) => {
                  setClaudePath(e.target.value);
                  setError(null);
                  setBatchResult(null);
                }}
                placeholder={t("claudeCodePathPlaceholder")}
              />
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {batchResult && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-300">
              {t("batchImportSuccess", { count: batchResult.imported })}
              {batchResult.failed > 0 && (
                <span className="text-muted-foreground ml-1">
                  ({t("batchImportFailed", { count: batchResult.failed })})
                </span>
              )}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetState();
            }}
          >
            {batchResult ? tc("close") : tc("cancel")}
          </Button>
          {tab === "url" && !batchResult && (
            <Button
              onClick={handleImportUrl}
              disabled={importing || !url.trim()}
            >
              {importing ? t("importing") : t("import")}
            </Button>
          )}
          {tab === "claude" && !batchResult && (
            <Button
              onClick={handleClaudeCodeImport}
              disabled={importing}
            >
              {importing ? t("claudeCodeScanning") : t("claudeCodeScan")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
