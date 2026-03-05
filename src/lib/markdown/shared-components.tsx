"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Components } from "react-markdown";
import type { PluggableList } from "unified";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { FileText, Copy, CheckCheck } from "lucide-react";

function unescapeCitationFilename(raw: string): string {
  return raw.replace(/\\(["\\])/g, "$1");
}

function normalizeGroupedCitations(text: string): string {
  return text.replace(
    /\[(Source\s+\d+(?:\s*;\s*Source\s+\d+)+)(?::\s*"((?:[^"\\]|\\.)*)")?\]/g,
    (_, sourcesPart: string, filename: string | undefined) => {
      const sourceRefs = sourcesPart.split(/\s*;\s*/);
      return sourceRefs
        .map((ref) =>
          filename ? `[${ref.trim()}: "${filename}"]` : `[${ref.trim()}]`
        )
        .join("");
    }
  );
}

export function CitationText({ text }: { text: string }) {
  const normalized = normalizeGroupedCitations(text);
  const parts = normalized.split(/(\[Source\s+\d+(?::\s*"(?:[^"\\]|\\.)*")?\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[Source\s+(\d+)(?::\s*"((?:[^"\\]|\\.)*)")?\]$/);
        if (match) {
          const num = match[1];
          const rawFileName = match[2];
          const fileName = rawFileName ? unescapeCitationFilename(rawFileName) : undefined;
          return (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary align-middle mx-0.5"
              title={fileName ? `Source ${num}: ${fileName}` : `Source ${num}`}
            >
              <FileText className="h-3 w-3" />
              {fileName || `Source ${num}`}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function CodeBlock({ children, className, ...rest }: React.HTMLAttributes<HTMLElement>) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const langMatch = className?.match(/language-(\w+)/);
  const lang = langMatch?.[1];

  const handleCopy = useCallback(async () => {
    const text = codeRef.current?.textContent ?? "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard write failed
    }
  }, []);

  return (
    <div className="code-block-wrapper">
      {lang && <span className="code-lang-label">{lang}</span>}
      <button
        onClick={handleCopy}
        className="code-copy-btn rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        title="Copy code"
        type="button"
      >
        {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <code ref={codeRef} className={className} {...rest}>
        {children}
      </code>
    </div>
  );
}

export function processChildren(children: React.ReactNode): React.ReactNode {
  if (!children) return children;
  if (typeof children === "string") {
    if (/\[Source\s+\d+/.test(children)) {
      return <CitationText text={children} />;
    }
    return children;
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      const processed = processChildren(child);
      if (processed !== child && typeof processed === "object") {
        // Use child content + index as a more stable key than index alone
        const keyHint = typeof child === "string" ? child.slice(0, 32) : String(i);
        return <span key={`${keyHint}-${i}`}>{processed}</span>;
      }
      return processed;
    });
  }
  if (React.isValidElement(children)) {
    const props = children.props as Record<string, unknown>;
    if (props.children) {
      const processedChildren = processChildren(props.children as React.ReactNode);
      if (processedChildren !== props.children) {
        return React.cloneElement(children, {}, processedChildren);
      }
    }
  }
  return children;
}

export function renderWithProcessedChildren(
  Tag: keyof React.JSX.IntrinsicElements
): (props: { children?: React.ReactNode }) => React.JSX.Element {
  return function Component({ children, ...rest }: { children?: React.ReactNode }) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Tag {...(rest as any)}>
        {processChildren(children)}
      </Tag>
    );
  };
}

export const markdownComponents: Components = {
  p: renderWithProcessedChildren("p"),
  li: renderWithProcessedChildren("li"),
  h1: renderWithProcessedChildren("h1"),
  h2: renderWithProcessedChildren("h2"),
  h3: renderWithProcessedChildren("h3"),
  h4: renderWithProcessedChildren("h4"),
  h5: renderWithProcessedChildren("h5"),
  h6: renderWithProcessedChildren("h6"),
  blockquote: renderWithProcessedChildren("blockquote"),
  th: renderWithProcessedChildren("th"),
  td: renderWithProcessedChildren("td"),
  pre({ children }) {
    return <pre>{children}</pre>;
  },
  code({ children, className, ...rest }) {
    const isBlock = className?.includes("hljs") || className?.includes("language-");
    if (isBlock) {
      return (
        <CodeBlock className={className} {...rest}>
          {children}
        </CodeBlock>
      );
    }
    return <code className={className} {...rest}>{children}</code>;
  },
};

export const remarkPlugins: PluggableList = [remarkGfm, remarkMath];
export const rehypePlugins: PluggableList = [rehypeKatex, rehypeHighlight];
