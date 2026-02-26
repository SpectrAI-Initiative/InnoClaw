"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileDown, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFileName } from "@/lib/utils";
import Script from "next/script";

/** Maximum file size (in bytes) before showing a warning — 10 MB */
const MAX_MOL_FILE_SIZE = 10 * 1024 * 1024;

interface MolViewerProps {
  filePath: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $3Dmol: any;
  }
}

export function MolViewer({ filePath }: MolViewerProps) {
  const t = useTranslations("files");
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [molData, setMolData] = useState<string | null>(null);

  const rawUrl = `/api/files/raw?path=${encodeURIComponent(filePath)}`;
  const fileName = getFileName(filePath, "molecule");
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

  // Map file extension to 3Dmol format string
  const formatMap: Record<string, string> = {
    pdb: "pdb",
    mol: "mol",
    mol2: "mol2",
    sdf: "sdf",
    sd: "sdf",
    xyz: "xyz",
    cif: "cif",
  };
  const format = formatMap[ext] ?? "pdb";

  // Fetch file content with abort support and size check
  useEffect(() => {
    const controller = new AbortController();
    let canceled = false;

    fetch(rawUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch file");
        const contentLength = res.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_MOL_FILE_SIZE) {
          throw new Error("File too large for in-browser preview");
        }
        return res.text();
      })
      .then((text) => {
        if (canceled) return;
        setMolData(text);
      })
      .catch((err) => {
        if (canceled || err.name === "AbortError") return;
        console.error("Failed to fetch molecular file:", err);
        setError(true);
      });

    return () => {
      canceled = true;
      controller.abort();
    };
  }, [rawUrl]);

  // Derive loading state from data readiness
  const isReady = scriptLoaded && molData !== null && !error;

  // Initialize viewer once both script and data are ready
  useEffect(() => {
    if (!scriptLoaded || !molData || !containerRef.current) return;
    if (typeof window.$3Dmol === "undefined") return;

    const container = containerRef.current;
    // Clear any previous viewer
    container.textContent = "";

    try {
      const viewer = window.$3Dmol.createViewer(container, {
        backgroundColor: "white",
      });
      viewerRef.current = viewer;
      viewer.addModel(molData, format);
      viewer.setStyle({}, { cartoon: { color: "spectrum" }, stick: {} });
      viewer.zoomTo();
      viewer.render();
    } catch (err) {
      console.error("Failed to initialize 3Dmol viewer:", err);
      // Deferred to satisfy react-hooks/set-state-in-effect lint rule
      queueMicrotask(() => setError(true));
    }

    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.clear();
        } catch {
          // viewer already disposed
        }
        viewerRef.current = null;
      }
    };
  }, [scriptLoaded, molData, format]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">{t("molPreviewFailed")}</p>
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
    <>
      <Script
        src="/3Dmol/3Dmol-min.js"
        strategy="lazyOnload"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setError(true)}
      />
      <div className="flex h-full flex-col gap-2 pt-4">
        <div className="flex items-center justify-end gap-2">
          <a href={rawUrl} download={fileName}>
            <Button variant="outline" size="sm">
              <FileDown className="mr-2 h-4 w-4" />
              {t("downloadFile")}
            </Button>
          </a>
        </div>
        <div className="relative flex-1 rounded border overflow-hidden">
          {!isReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div
            ref={containerRef}
            className="w-full h-full"
            aria-label={`Interactive 3D visualization of ${fileName}`}
            role="img"
          />
        </div>
      </div>
    </>
  );
}
