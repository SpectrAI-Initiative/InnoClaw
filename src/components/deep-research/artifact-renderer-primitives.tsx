"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ArtifactSection({
  title,
  children,
  className = "space-y-2",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

export function ArtifactCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`rounded border p-3 ${className}`.trim()}>{children}</div>;
}

export function ArtifactNotice({
  title,
  children,
  tone = "muted",
}: {
  title?: string;
  children: React.ReactNode;
  tone?: "muted" | "blue" | "green" | "yellow" | "emerald" | "slate";
}) {
  const toneStyles: Record<typeof tone, { container: string; title: string; body: string }> = {
    muted: {
      container: "bg-muted",
      title: "text-muted-foreground",
      body: "text-foreground",
    },
    blue: {
      container: "bg-blue-50 dark:bg-blue-950/50",
      title: "text-blue-800 dark:text-blue-200",
      body: "text-blue-700 dark:text-blue-300",
    },
    green: {
      container: "bg-green-50 dark:bg-green-950/50",
      title: "text-green-800 dark:text-green-200",
      body: "text-green-700 dark:text-green-300",
    },
    yellow: {
      container: "bg-yellow-50 dark:bg-yellow-950",
      title: "text-yellow-800 dark:text-yellow-200",
      body: "text-yellow-700 dark:text-yellow-300",
    },
    emerald: {
      container: "bg-emerald-50 dark:bg-emerald-950/40",
      title: "text-emerald-800 dark:text-emerald-200",
      body: "text-emerald-700 dark:text-emerald-300",
    },
    slate: {
      container: "bg-slate-50 dark:bg-slate-900/50",
      title: "text-slate-800 dark:text-slate-200",
      body: "text-slate-700 dark:text-slate-300",
    },
  };
  const styles = toneStyles[tone];

  return (
    <div className={`rounded p-2 text-xs ${styles.container}`}>
      {title ? <div className={`mb-1 font-medium ${styles.title}`}>{title}</div> : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
}

export function SectionList({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: string[];
  compact?: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <div className={`font-medium text-muted-foreground ${compact ? "text-[11px] mb-1" : "text-xs mb-1.5"}`}>{title}</div>
      <ul className={`${compact ? "text-[11px]" : "text-xs"} space-y-0.5 list-disc pl-4 text-muted-foreground`}>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function MarkdownDisplay({ text }: { text: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
