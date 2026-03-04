import type { ReportData } from "@/types/report";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert markdown to sanitized HTML string.
 * Used for PDF print preview where we need formatted output.
 */
async function markdownToSafeHtml(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(markdown);
  return String(result);
}

export function downloadAsMarkdown(report: ReportData) {
  const blob = new Blob([report.markdownContent], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_").slice(0, 60)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadAsPdf(report: ReportData) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const safeHtml = await markdownToSafeHtml(report.markdownContent);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(report.title)}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          line-height: 1.8;
          max-width: 720px;
          margin: 0 auto;
          padding: 2rem;
          color: #1a1a1a;
        }
        h1 { font-size: 1.875em; font-weight: 700; margin-top: 0; margin-bottom: 0.75em; }
        h2 { font-size: 1.375em; font-weight: 600; margin-top: 2em; margin-bottom: 0.5em; }
        h3 { font-size: 1.125em; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.4em; }
        p { margin: 0.75em 0; }
        img { max-width: 100%; }
        pre { background: #f5f5f5; padding: 1em; border-radius: 8px; overflow-x: auto; }
        code { font-family: monospace; font-size: 0.875em; }
        blockquote { border-left: 3px solid #ddd; padding-left: 1em; color: #666; font-style: italic; }
        table { width: 100%; border-collapse: collapse; margin: 0.75em 0; }
        th, td { padding: 0.5em 0.75em; border-bottom: 1px solid #ddd; text-align: left; }
        th { font-weight: 600; background: #f9f9f9; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div id="content"></div>
    </body>
    </html>
  `);
  printWindow.document.close();

  // Set sanitized HTML via DOM API (avoids inline <script> XSS)
  const contentEl = printWindow.document.getElementById("content");
  if (contentEl) {
    contentEl.innerHTML = safeHtml;
  }

  printWindow.addEventListener("afterprint", () => {
    printWindow.close();
  });

  // Defer print() to ensure the content is fully rendered before the dialog opens.
  printWindow.addEventListener("load", () => {
    printWindow.print();
  });
}

export async function copyReportContent(report: ReportData): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(report.markdownContent);
    return true;
  } catch {
    return false;
  }
}
