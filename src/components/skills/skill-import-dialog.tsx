"use client";

import React, { useState, useRef, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Globe,
  FileUp,
  CheckCircle2,
  ArrowLeft,
  Search,
  Loader2,
} from "lucide-react";
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

interface PreviewSkill {
  path: string;
  fallbackSlug: string;
  name: string;
  slug: string;
  description: string | null;
}

interface PreviewData {
  skills: PreviewSkill[];
  branch: string;
  owner: string;
  repo: string;
  singleFile: boolean;
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

  // Preview state
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSkills = useMemo(() => {
    if (!previewData) return [];
    if (!searchQuery.trim()) return previewData.skills;
    const q = searchQuery.toLowerCase();
    return previewData.skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [previewData, searchQuery]);

  const resetState = () => {
    setUrl("");
    setError(null);
    setImporting(false);
    setBatchResult(null);
    setPreviewData(null);
    setSelectedPaths(new Set());
    setSearchQuery("");
    setPreviewing(false);
  };

  const isGitHubUrl = (urlStr: string): boolean => {
    try {
      const parsed = new URL(urlStr);
      const host = parsed.hostname.toLowerCase();
      return (
        host === "github.com" ||
        host === "www.github.com" ||
        host === "raw.githubusercontent.com"
      );
    } catch {
      return false;
    }
  };

  const handlePreview = async () => {
    if (!url.trim()) return;

    setPreviewing(true);
    setError(null);
    setBatchResult(null);

    try {
      const res = await fetch("/api/skills/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || t("importError"));
        setPreviewing(false);
        return;
      }

      const data = await res.json();

      if (data.singleFile) {
        // Single file - import directly
        await doImport({ url: url.trim() });
        setPreviewing(false);
        return;
      }

      setPreviewData(data);
      // Select all by default
      setSelectedPaths(new Set(data.skills.map((s: PreviewSkill) => s.path)));
    } catch {
      setError(t("importError"));
    } finally {
      setPreviewing(false);
    }
  };

  const doImport = async (payload: {
    url?: string;
    skill?: unknown;
    workspaceId?: string | null;
    paths?: string[];
    branch?: string;
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

      if (result.batch) {
        setBatchResult({ imported: result.imported, failed: result.failed });
        onImported();
        return result;
      }

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

    // For GitHub URLs, go through preview flow
    if (isGitHubUrl(url.trim())) {
      await handlePreview();
      return;
    }

    // For non-GitHub URLs, import directly
    await doImport({ url: url.trim() });
  };

  const handleImportSelected = async () => {
    if (!previewData || selectedPaths.size === 0) return;
    await doImport({
      url: url.trim(),
      paths: Array.from(selectedPaths),
      branch: previewData.branch,
    });
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

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleSelectAll = () => {
    if (selectedPaths.size === filteredSkills.length) {
      // Deselect all visible
      const filtered = new Set(filteredSkills.map((s) => s.path));
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        for (const p of filtered) next.delete(p);
        return next;
      });
    } else {
      // Select all visible
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        for (const s of filteredSkills) next.add(s.path);
        return next;
      });
    }
  };

  const togglePath = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const allFilteredSelected =
    filteredSkills.length > 0 &&
    filteredSkills.every((s) => selectedPaths.has(s.path));

  // Show preview/selection view
  if (previewData && !batchResult) {
    return (
      <Dialog
        open={open}
        onOpenChange={(v) => {
          onOpenChange(v);
          if (!v) resetState();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setPreviewData(null);
                  setSelectedPaths(new Set());
                  setSearchQuery("");
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {t("previewFound", { count: previewData.skills.length })}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {previewData.owner}/{previewData.repo} ({previewData.branch})
            </p>
          </DialogHeader>

          {/* Search & select all */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchSkills")}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="shrink-0 text-xs"
            >
              {allFilteredSelected ? t("deselectAll") : t("selectAll")}
            </Button>
          </div>

          {/* Skills list */}
          <ScrollArea className="flex-1 min-h-0 rounded-md border">
            <div className="p-1">
              {filteredSkills.map((skill) => (
                <label
                  key={skill.path}
                  className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedPaths.has(skill.path)}
                    onCheckedChange={() => togglePath(skill.path)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm truncate">
                        {skill.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">
                        /{skill.slug}
                      </span>
                    </div>
                    {skill.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {skill.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
              {filteredSkills.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t("noMatchingSkills")}
                </div>
              )}
            </div>
          </ScrollArea>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {t("selectedCount", { count: selectedPaths.size })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  resetState();
                }}
              >
                {tc("cancel")}
              </Button>
              <Button
                onClick={handleImportSelected}
                disabled={importing || selectedPaths.size === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    {t("importing")}
                  </>
                ) : (
                  t("importSelected", { count: selectedPaths.size })
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setBatchResult(null);
            setError(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              URL
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-1.5">
              <FileUp className="h-3.5 w-3.5" />
              {t("importFromFile")}
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
        </Tabs>

        {error && <p className="text-sm text-destructive">{error}</p>}

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
              disabled={importing || previewing || !url.trim()}
            >
              {previewing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {t("previewLoading")}
                </>
              ) : importing ? (
                t("importing")
              ) : (
                t("import")
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
