"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Eye, X, FileDown, AlertCircle, Loader2, GraduationCap } from "lucide-react";
import { PAPER_ELIGIBLE_EXTENSIONS, PLAIN_TEXT_EXTS, CODE_EXTS, MOL_EXTS, CAD_EXTS, IMAGE_EXTS } from "@/lib/constants";
import { getFileName } from "@/lib/utils";
import { PdfViewer } from "@/components/files/pdf-viewer";
import { MolViewer } from "@/components/files/mol-viewer";
import { MarkdownPreview } from "@/components/preview/markdown-preview";
import { useFileContent } from "@/lib/hooks/use-file-content";
import { SaveStatus } from "@/components/preview/save-status";

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

// Lazy-load CodePreview so CodeMirror is only fetched when a code file is opened
const CodePreview = dynamic(
  () =>
    import("@/components/preview/code-preview").then(
      (mod) => mod.CodePreview,
    ),
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
  onStudyPaper?: (filePath: string) => void;
}

function getFileType(filePath: string) {
  const filename = getFileName(filePath).toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  // Special filenames without extensions
  if (filename === "dockerfile" || filename === "makefile") return "code" as const;
  if (ext === "pdf") return "pdf" as const;
  if (ext === "md" || ext === "markdown") return "markdown" as const;
  if ((MOL_EXTS as readonly string[]).includes(ext)) return "mol" as const;
  if ((CAD_EXTS as readonly string[]).includes(ext)) return "cad" as const;
  if ((IMAGE_EXTS as readonly string[]).includes(ext)) return "image" as const;
  if ((CODE_EXTS as readonly string[]).includes(ext)) return "code" as const;
  if ((PLAIN_TEXT_EXTS as readonly string[]).includes(ext)) return "text" as const;
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
  const { content, loading, saving, modified, handleSave, updateContent } =
    useFileContent({ filePath });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-2 border-b px-3 py-1.5">
        <SaveStatus saving={saving} modified={modified} />
      </div>
      <Textarea
        className="flex-1 resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
        value={content}
        onChange={(e) => updateContent(e.target.value)}
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

function isPaperEligible(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return (PAPER_ELIGIBLE_EXTENSIONS as readonly string[]).includes(ext);
}

export function FilePreviewPanel({ filePath, onClose, onStudyPaper }: FilePreviewPanelProps) {
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
            <div className="ml-auto flex items-center gap-1">
              {onStudyPaper && isPaperEligible(filePath) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  onClick={() => onStudyPaper(filePath)}
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  {t("studyPaper")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
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
        ) : fileType === "code" ? (
          <CodePreview filePath={filePath} />
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
