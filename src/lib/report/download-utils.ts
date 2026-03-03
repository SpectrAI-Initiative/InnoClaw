import type { ReportData } from "@/types/report";

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

export function downloadAsPdf(report: ReportData) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${report.title}</title>
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
      <script>
        document.getElementById("content").innerHTML = ${JSON.stringify(report.markdownContent)};
        window.print();
        window.close();
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

export async function copyShareLink(report: ReportData): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(report.markdownContent);
    return true;
  } catch {
    return false;
  }
}
