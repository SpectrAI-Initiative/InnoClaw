"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfViewerProps {
  filePath: string;
}

export function PdfViewer({ filePath }: PdfViewerProps) {
  const t = useTranslations("files");
  const [error, setError] = useState(false);

  const rawUrl = `/api/files/raw?path=${encodeURIComponent(filePath)}`;
  const fileName =
    filePath.split("/").pop() || filePath.split("\\").pop() || "file.pdf";

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">{t("pdfPreviewFailed")}</p>
        <a href={rawUrl} download={fileName}>
          <Button variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            {t("downloadFile")}
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 pt-4">
      <div className="flex items-center justify-end gap-2">
        <a href={rawUrl} download={fileName}>
          <Button variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            {t("downloadFile")}
          </Button>
        </a>
      </div>
      <iframe
        src={rawUrl}
        className="flex-1 rounded border"
        title={fileName}
        onError={() => setError(true)}
      />
    </div>
  );
}
