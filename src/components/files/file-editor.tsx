"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";

interface FileEditorProps {
  filePath: string;
  onSaved: () => void;
}

export function FileEditor({ filePath, onSaved }: FileEditorProps) {
  const t = useTranslations("files");
  const tCommon = useTranslations("common");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/files/read?path=${encodeURIComponent(filePath)}`
        );
        if (res.ok) {
          const data = await res.json();
          setContent(data.content);
          setModified(false);
        }
      } catch {
        toast.error("Failed to load file");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filePath]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content }),
      });
      setModified(false);
      toast.success(t("saved"));
      onSaved();
    } catch {
      toast.error("Failed to save file");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {tCommon("loading")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 pt-4">
      <div className="flex items-center justify-end gap-2">
        {modified && (
          <span className="text-xs text-muted-foreground">Modified</span>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving || !modified}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? t("saving") : tCommon("save")}
        </Button>
      </div>
      <Textarea
        className="flex-1 resize-none font-mono text-sm"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setModified(true);
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            handleSave();
          }
        }}
      />
    </div>
  );
}
