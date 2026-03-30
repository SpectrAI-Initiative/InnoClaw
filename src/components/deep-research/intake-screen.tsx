"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Brain,
  Upload,
  FileText,
  X,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

interface IntakeScreenProps {
  workspaceId: string;
  onCreated: (sessionId: string) => void;
  onCancel: () => void;
}

interface UploadedFile {
  name: string;
  size: number;
  content: string;
}

export function IntakeScreen({ workspaceId, onCreated, onCancel }: IntakeScreenProps) {
  const [mode, setMode] = useState<"text" | "upload">("text");
  const [title, setTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [supplementalNotes, setSupplementalNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [readingFiles, setReadingFiles] = useState(false);

  const canCreate =
    title.trim().length > 0 &&
    (mode === "text"
      ? textContent.trim().length > 0
      : uploadedFiles.length > 0);

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    });
  };

  const handleFileSelect = useCallback(async (files: FileList) => {
    setReadingFiles(true);
    try {
      const newFiles: UploadedFile[] = [];
      for (const file of Array.from(files)) {
        try {
          const content = await readFileAsText(file);
          newFiles.push({ name: file.name, size: file.size, content });
        } catch {
          toast.error(`Could not read "${file.name}". Only text-based files are supported.`);
        }
      }
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      if (newFiles.length > 0 && !title.trim()) {
        // Auto-suggest title from first file name
        const suggested = newFiles[0].name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
        setTitle(suggested);
      }
    } finally {
      setReadingFiles(false);
    }
  }, [title]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
    [handleFileSelect]
  );

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);

    try {
      let content: string;
      let files: { name: string; size: number }[] | undefined;

      if (mode === "text") {
        content = textContent.trim();
      } else {
        // Combine file contents with metadata headers
        const parts = uploadedFiles.map(
          (f) => `--- File: ${f.name} ---\n${f.content}`
        );
        if (supplementalNotes.trim()) {
          parts.push(`--- Additional Notes ---\n${supplementalNotes.trim()}`);
        }
        content = parts.join("\n\n");
        files = uploadedFiles.map((f) => ({ name: f.name, size: f.size }));
      }

      const res = await fetch("/api/deep-research/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: title.trim(),
          content,
          files,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create session");
      }

      const session = await res.json();
      onCreated(session.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create research session");
    } finally {
      setCreating(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Brain className="h-5 w-5 text-purple-500" />
        <h2 className="text-base font-semibold">New Deep Research</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Project title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Survey of transformer architectures for time series"
              className="text-sm"
              autoFocus
            />
          </div>

          {/* Mode tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "text" | "upload")}>
            <TabsList className="w-full">
              <TabsTrigger value="text" className="flex-1 gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Direct Input
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex-1 gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" />
                Upload Files
              </TabsTrigger>
            </TabsList>

            {/* Text mode */}
            <TabsContent value="text" className="mt-4 space-y-2">
              <Label htmlFor="text-content" className="text-xs text-muted-foreground">
                Describe your research question, problem, or requirements
              </Label>
              <Textarea
                id="text-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Type or paste your research requirements here...&#10;&#10;For example:&#10;- A research question you want to explore&#10;- A problem statement to investigate&#10;- A hypothesis to test&#10;- Technical requirements to analyze"
                className="text-sm min-h-[240px] resize-none"
                rows={12}
              />
              <p className="text-[11px] text-muted-foreground">
                Your input becomes the initial Deep Research context and can drive either the executable workflow or the structured role workspace, depending on the session configuration.
              </p>
            </TabsContent>

            {/* Upload mode */}
            <TabsContent value="upload" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Upload documents, notes, papers, or requirement files
                </Label>

                {/* Drop zone */}
                <div
                  className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/40"
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
                    input.accept = ".txt,.md,.pdf,.doc,.docx,.csv,.json,.yaml,.yml,.tex,.bib,.html,.xml,.py,.js,.ts,.r,.ipynb";
                    input.onchange = () => {
                      if (input.files) handleFileSelect(input.files);
                    };
                    input.click();
                  }}
                >
                  {readingFiles ? (
                    <>
                      <Loader2 className="mb-2 h-6 w-6 text-muted-foreground animate-spin" />
                      <p className="text-sm text-muted-foreground">Reading files...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Drop files here or click to browse
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Supports text-based files: .txt, .md, .csv, .json, .yaml, .tex, .py, etc.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* File list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} selected
                  </Label>
                  <div className="space-y-1">
                    {uploadedFiles.map((file, i) => (
                      <div
                        key={`${file.name}-${i}`}
                        className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md group"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs flex-1 truncate">{file.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatSize(file.size)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i);
                          }}
                          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Supplemental notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs text-muted-foreground">
                  Additional notes (optional)
                </Label>
                <Textarea
                  id="notes"
                  value={supplementalNotes}
                  onChange={(e) => setSupplementalNotes(e.target.value)}
                  placeholder="Add context, specific questions, or instructions for the research..."
                  className="text-sm min-h-[80px] resize-none"
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
        <Button variant="ghost" onClick={onCancel} className="text-xs">
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          disabled={!canCreate || creating}
          className="gap-1.5"
        >
          {creating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">Creating...</span>
            </>
          ) : (
            <>
              <Brain className="h-3.5 w-3.5" />
              <span className="text-xs">Create Research Project</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
