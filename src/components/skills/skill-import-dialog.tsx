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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, FileUp, ClipboardPaste, CheckCircle2 } from "lucide-react";

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
  const [jsonText, setJsonText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setUrl("");
    setJsonText("");
    setError(null);
    setImporting(false);
    setBatchResult(null);
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

  const handleImportJson = async () => {
    if (!jsonText.trim()) return;
    try {
      const parsed = JSON.parse(jsonText.trim());
      await doImport({ skill: parsed });
    } catch {
      setError(t("invalidJson"));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await doImport({ skill: parsed });
    } catch {
      setError(t("invalidJson"));
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

        <Tabs value={tab} onValueChange={(v) => { setTab(v); setBatchResult(null); setError(null); }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              URL
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-1.5">
              <FileUp className="h-3.5 w-3.5" />
              {t("importFromFile")}
            </TabsTrigger>
            <TabsTrigger value="json" className="gap-1.5">
              <ClipboardPaste className="h-3.5 w-3.5" />
              JSON
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
              accept=".json"
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

          <TabsContent value="json" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              {t("importJsonDesc")}
            </p>
            <Textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setError(null);
              }}
              placeholder={t("importJsonPlaceholder")}
              className="min-h-[200px] font-mono text-xs"
            />
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
          {tab !== "file" && !batchResult && (
            <Button
              onClick={tab === "url" ? handleImportUrl : handleImportJson}
              disabled={
                importing ||
                (tab === "url" ? !url.trim() : !jsonText.trim())
              }
            >
              {importing ? t("importing") : t("import")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
