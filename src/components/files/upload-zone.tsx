"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface UploadZoneProps {
  targetDir: string;
  onUploadComplete: () => void;
}

export function UploadZone({ targetDir, onUploadComplete }: UploadZoneProps) {
  const t = useTranslations("files");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(
    async (files: FileList) => {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("targetDir", targetDir);

          const res = await fetch("/api/files/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
        }
        toast.success(`Uploaded ${files.length} file(s)`);
        onUploadComplete();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Upload failed"
        );
      } finally {
        setUploading(false);
      }
    },
    [targetDir, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
  );

  return (
    <div
      className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.onchange = () => {
          if (input.files) handleUpload(input.files);
        };
        input.click();
      }}
    >
      <Upload className="mb-4 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {uploading ? "Uploading..." : t("dragDrop")}
      </p>
    </div>
  );
}
