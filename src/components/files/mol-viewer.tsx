"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileDown, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Script from "next/script";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [molData, setMolData] = useState<string | null>(null);

  const rawUrl = `/api/files/raw?path=${encodeURIComponent(filePath)}`;
  const fileName =
    filePath.split("/").pop() || filePath.split("\\").pop() || "molecule";
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

  // Fetch file content
  useEffect(() => {
    setLoading(true);
    setError(false);
    setMolData(null);
    fetch(rawUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch file");
        return res.text();
      })
      .then((text) => setMolData(text))
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [rawUrl]);

  // Initialize viewer once both script and data are ready
  useEffect(() => {
    if (!scriptLoaded || !molData || !containerRef.current) return;
    if (typeof window.$3Dmol === "undefined") return;

    const container = containerRef.current;
    // Clear any previous viewer
    container.innerHTML = "";

    try {
      const viewer = window.$3Dmol.createViewer(container, {
        backgroundColor: "white",
      });
      viewer.addModel(molData, format);
      viewer.setStyle({}, { cartoon: { color: "spectrum" }, stick: {} });
      viewer.zoomTo();
      viewer.render();
      setLoading(false);
    } catch {
      setError(true);
      setLoading(false);
    }
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
        src="https://3dmol.org/build/3Dmol-min.js"
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
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" aria-label={fileName} role="img" />
        </div>
      </div>
    </>
  );
}
