"use client";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface DatasetPreviewTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
}

export function DatasetPreviewTable({ columns, rows }: DatasetPreviewTableProps) {
  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No preview data available.
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="min-w-max">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-b-0 hover:bg-muted/50">
                <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 max-w-xs truncate" title={String(row[col] ?? "")}>
                    {renderCellValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function renderCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
