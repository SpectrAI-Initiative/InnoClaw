"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Pencil, X, Save, FileDown, AlertCircle, Loader2 } from "lucide-react";
import { getFileName } from "@/lib/utils";
import { PdfViewer } from "@/components/files/pdf-viewer";
import { MolViewer } from "@/components/files/mol-viewer";
import {
  markdownComponents,
  remarkPlugins,
  rehypePlugins,
} from "@/lib/markdown/shared-components";
import { toast } from "sonner";

// Lazy-load CadViewer so Three.js is only fetched when a CAD file is opened
const CadViewer = dynamic(
  () => import("@/components/files/cad-viewer").then((mod) => mod.CadViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

interface FilePreviewPanelProps {
  filePath: string | null;
  onClose: () => void;
}

const EDITABLE_EXTS = [
  "txt", "json", "csv", "html", "css", "js", "ts", "tsx", "jsx",
  "py", "yaml", "yml", "xml", "toml", "ini", "cfg", "env", "sh", "bat",
  "log", "conf", "c", "cpp", "h", "hpp", "java", "go", "rs", "rb", "php",
];
const MOL_EXTS = ["pdb", "mol", "mol2", "sdf", "sd", "xyz", "cif"];
const CAD_EXTS = ["stl", "obj", "ply", "vtk", "vtp", "gltf", "glb", "fbx", "dae", "3ds", "3mf", "pcd"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];

function getFileType(filePath: string) {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf" as const;
  if (ext === "md") return "markdown" as const;
  if (MOL_EXTS.includes(ext)) return "mol" as const;
  if (CAD_EXTS.includes(ext)) return "cad" as const;
  if (IMAGE_EXTS.includes(ext)) return "image" as const;
  if (EDITABLE_EXTS.includes(ext)) return "text" as const;
  return "unknown" as const;
}

function ImagePreview({ filePath }: { filePath: string }) {
  const t = useTranslations("files");
  const rawUrl = `/api/files/raw?path=${encodeURIComponent(filePath)}`;
  const fileName = getFileName(filePath);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-2 px-3 py-2">
        <a href={rawUrl} download={fileName}>
          <Button variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            {t("downloadFile")}
          </Button>
        </a>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={rawUrl}
          alt={fileName}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    </div>
  );
}

function TextPreview({ filePath }: { filePath: string }) {
  const t = useTranslations("files");
  const tCommon = useTranslations("common");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setModified(false);

    fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load file");
        return res.json();
      })
      .then((data) => {
        if (!canceled) setContent(data.content);
      })
      .catch(() => {
        if (!canceled) toast.error("Failed to load file");
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => { canceled = true; };
  }, [filePath]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content }),
      });
      if (!res.ok) {
        throw new Error("Failed to save file");
      }
      setModified(false);
      toast.success(t("saved"));
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
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center justify-end gap-2">
        {modified && (
          <span className="text-xs text-muted-foreground">{tCommon("modified")}</span>
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

function MarkdownPreview({ filePath }: { filePath: string }) {
  const t = useTranslations("preview");
  const tCommon = useTranslations("common");
  const tFiles = useTranslations("files");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setModified(false);
    setViewMode("preview");

    fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load file");
        return res.json();
      })
      .then((data) => {
        if (!canceled) setContent(data.content);
      })
      .catch(() => {
        if (!canceled) toast.error("Failed to load file");
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => { canceled = true; };
  }, [filePath]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content }),
      });
      if (!res.ok) throw new Error("Failed to save file");
      setModified(false);
      toast.success(tFiles("saved"));
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-2 px-3 py-2">
        {modified && (
          <span className="text-xs text-muted-foreground">{tCommon("modified")}</span>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("preview")}
            title={t("previewMode")}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            {t("previewMode")}
          </Button>
          <Button
            variant={viewMode === "edit" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("edit")}
            title={t("editMode")}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {t("editMode")}
          </Button>
        </div>
        {viewMode === "edit" && (
          <Button size="sm" onClick={handleSave} disabled={saving || !modified}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? tFiles("saving") : tCommon("save")}
          </Button>
        )}
      </div>
      {viewMode === "preview" ? (
        <ScrollArea className="flex-1 px-4 py-2">
          <div className="chat-prose">
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={rehypePlugins}
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
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
      )}
    </div>
  );
}

function UnsupportedPreview({ filePath }: { filePath: string }) {
  const t = useTranslations("files");
  const tPreview = useTranslations("preview");
  const rawUrl = `/api/files/raw?path=${encodeURIComponent(filePath)}`;
  const fileName = getFileName(filePath);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <AlertCircle className="h-8 w-8" />
      <p className="text-sm">{tPreview("unsupported")}</p>
      <a href={rawUrl} download={fileName}>
        <Button variant="outline" size="sm">
          <FileDown className="mr-2 h-4 w-4" />
          {t("downloadFile")}
        </Button>
      </a>
    </div>
  );
}

export function FilePreviewPanel({ filePath, onClose }: FilePreviewPanelProps) {
  const t = useTranslations("preview");
  const fileName = filePath ? getFileName(filePath) : "";
  const fileType = filePath ? getFileType(filePath) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t("title")}</span>
        {filePath && (
          <>
            <span className="text-xs text-muted-foreground truncate ml-1">
              — {fileName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ml-auto h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!filePath ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
          </div>
        ) : fileType === "pdf" ? (
          <PdfViewer filePath={filePath} />
        ) : fileType === "mol" ? (
          <MolViewer filePath={filePath} />
        ) : fileType === "cad" ? (
          <CadViewer filePath={filePath} />
        ) : fileType === "image" ? (
          <ImagePreview filePath={filePath} />
        ) : fileType === "markdown" ? (
          <MarkdownPreview filePath={filePath} />
        ) : fileType === "text" ? (
          <TextPreview filePath={filePath} />
        ) : (
          <UnsupportedPreview filePath={filePath} />
        )}
      </div>
    </div>
  );
}
