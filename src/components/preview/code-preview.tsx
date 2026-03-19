"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import CodeMirror from "@uiw/react-codemirror";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { Button } from "@/components/ui/button";
import { Copy, CheckCheck } from "lucide-react";
import { useFileContent } from "@/lib/hooks/use-file-content";
import { useClipboard } from "@/lib/hooks/use-clipboard";
import { getFileName } from "@/lib/utils";

/** Map file extension to display name */
const EXT_TO_DISPLAY: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  json: "json",
  html: "html",
  xml: "xml",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  yaml: "yaml",
  yml: "yaml",
  sh: "bash",
  bat: "bash",
  java: "java",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  sql: "sql",
  kt: "kotlin",
  swift: "swift",
  scala: "scala",
  lua: "lua",
  pl: "perl",
  pm: "perl",
  r: "r",
  dart: "dart",
  groovy: "groovy",
  toml: "toml",
  dockerfile: "dockerfile",
  makefile: "makefile",
  cmake: "makefile",
  graphql: "graphql",
  proto: "protobuf",
};

function getDisplayLanguage(filePath: string): string | undefined {
  const filename = getFileName(filePath).toLowerCase();
  if (filename === "dockerfile") return "dockerfile";
  if (filename === "makefile") return "makefile";
  const ext = filename.split(".").pop() ?? "";
  return EXT_TO_DISPLAY[ext];
}

export function CodePreview({ filePath }: { filePath: string }) {
  const t = useTranslations("preview");
  const tCommon = useTranslations("common");
  const { resolvedTheme } = useTheme();
  const { copied, copy } = useClipboard();

  const { content, loading, saving, modified, handleSave, updateContent } =
    useFileContent({ filePath });

  const displayLanguage = useMemo(
    () => getDisplayLanguage(filePath),
    [filePath],
  );

  const lineCount = useMemo(
    () => (content || "").split("\n").length,
    [content],
  );

  // Dynamically load CodeMirror language support based on file extension
  const [langExtension, setLangExtension] = useState<Extension[]>([]);

  useEffect(() => {
    let canceled = false;
    const filename = getFileName(filePath);
    const lang = LanguageDescription.matchFilename(languages, filename);
    if (!lang) return;
    lang.load().then((support) => {
      if (!canceled) setLangExtension([support]);
    });
    return () => {
      canceled = true;
    };
  }, [filePath]);

  // Cmd/Ctrl+S keymap for immediate save — handleSave is now stable (ref-based)
  const saveKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-s",
          run: () => {
            handleSave();
            return true;
          },
        },
      ]),
    [handleSave],
  );

  const extensions = useMemo(
    () => [...langExtension, saveKeymap],
    [langExtension, saveKeymap],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {tCommon("loading")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <div className="flex items-center gap-2">
          {displayLanguage && (
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {displayLanguage}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {lineCount} lines
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {saving
              ? t("autoSaving")
              : modified
                ? tCommon("modified")
                : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copy(content)}
            className="h-7 w-7 p-0"
            title="Copy"
          >
            {copied ? (
              <CheckCheck className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* CodeMirror editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          extensions={extensions}
          onChange={updateContent}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          height="100%"
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}
