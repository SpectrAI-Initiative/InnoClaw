import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const PREVIEW_FORMATS = ["jsonl", "csv", "tsv", "json"];

/**
 * Preview the first N items from a dataset split.
 */
export async function previewItems(
  rootDir: string,
  split: string = "default",
  n: number = 20
): Promise<{ columns: string[]; rows: Record<string, unknown>[]; format: string; totalRows: number | null }> {
  // Find the split directory or files
  const splitDir = path.join(rootDir, split);
  // Guard against path traversal via split parameter
  const resolvedRoot = path.resolve(rootDir);
  if (!path.resolve(splitDir).startsWith(resolvedRoot + path.sep) && path.resolve(splitDir) !== resolvedRoot) {
    return { columns: [], rows: [], format: "unknown", totalRows: null };
  }
  let scanDir = rootDir;
  if (fs.existsSync(splitDir) && fs.statSync(splitDir).isDirectory()) {
    scanDir = splitDir;
  }

  // Find the first previewable file (prefer jsonl > csv > tsv > json)
  const files = fs.readdirSync(scanDir).filter((f) => {
    const stat = fs.statSync(path.join(scanDir, f));
    return stat.isFile();
  });

  for (const preferredFormat of PREVIEW_FORMATS) {
    const matchingFile = files.find((f) => {
      const ext = path.extname(f).toLowerCase();
      if (preferredFormat === "jsonl") return ext === ".jsonl" || ext === ".ndjson";
      if (preferredFormat === "csv") return ext === ".csv";
      if (preferredFormat === "tsv") return ext === ".tsv";
      if (preferredFormat === "json") return ext === ".json";
      return false;
    });

    if (matchingFile) {
      const filePath = path.join(scanDir, matchingFile);
      if (preferredFormat === "jsonl") {
        return previewJsonl(filePath, n);
      }
      if (preferredFormat === "csv") {
        return previewCsv(filePath, n, ",");
      }
      if (preferredFormat === "tsv") {
        return previewCsv(filePath, n, "\t");
      }
      if (preferredFormat === "json") {
        return previewJson(filePath, n);
      }
    }
  }

  return { columns: [], rows: [], format: "unknown", totalRows: null };
}

async function previewJsonl(
  filePath: string,
  n: number
): Promise<{ columns: string[]; rows: Record<string, unknown>[]; format: string; totalRows: number | null }> {
  const rows: Record<string, unknown>[] = [];
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    if (rows.length < n) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed));
      } catch {
        // skip malformed lines
      }
    }
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { columns, rows, format: "jsonl", totalRows: lineCount };
}

function previewCsv(
  filePath: string,
  n: number,
  delimiter: string
): { columns: string[]; rows: Record<string, unknown>[]; format: string; totalRows: number | null } {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);

  if (lines.length === 0) {
    return { columns: [], rows: [], format: delimiter === "\t" ? "tsv" : "csv", totalRows: 0 };
  }

  const columns = parseCsvLine(lines[0], delimiter);
  const rows: Record<string, unknown>[] = [];
  const totalRows = lines.length - 1;

  for (let i = 1; i <= Math.min(n, lines.length - 1); i++) {
    const values = parseCsvLine(lines[i], delimiter);
    const row: Record<string, unknown> = {};
    for (let j = 0; j < columns.length; j++) {
      row[columns[j]] = values[j] ?? null;
    }
    rows.push(row);
  }

  return { columns, rows, format: delimiter === "\t" ? "tsv" : "csv", totalRows };
}

function previewJson(
  filePath: string,
  n: number
): { columns: string[]; rows: Record<string, unknown>[]; format: string; totalRows: number | null } {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      const rows = data.slice(0, n) as Record<string, unknown>[];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { columns, rows, format: "json", totalRows: data.length };
    }
  } catch {
    // ignore parse errors
  }
  return { columns: [], rows: [], format: "json", totalRows: null };
}

/**
 * Simple CSV line parser that handles quoted fields.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}
