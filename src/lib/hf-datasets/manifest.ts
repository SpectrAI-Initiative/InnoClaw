import * as fs from "fs";
import * as path from "path";
import type { HfDatasetManifest, HfDatasetStats } from "@/types";

const KNOWN_SPLIT_NAMES = new Set([
  "train", "training",
  "valid", "validation", "val", "dev",
  "test", "testing", "eval",
]);

const FORMAT_EXTENSIONS: Record<string, string> = {
  ".jsonl": "jsonl",
  ".ndjson": "jsonl",
  ".json": "json",
  ".csv": "csv",
  ".tsv": "tsv",
  ".parquet": "parquet",
  ".arrow": "arrow",
  ".tar": "tar",
  ".tar.gz": "tar",
  ".zip": "zip",
  ".txt": "text",
  ".md": "text",
  ".py": "code",
  ".safetensors": "safetensors",
  ".bin": "binary",
  ".pt": "pytorch",
  ".gguf": "gguf",
};

function detectFormat(filePath: string): string {
  const lower = filePath.toLowerCase();
  for (const [ext, fmt] of Object.entries(FORMAT_EXTENSIONS)) {
    if (lower.endsWith(ext)) return fmt;
  }
  return "other";
}

function countRowsBestEffort(filePath: string, format: string): number | null {
  try {
    if (format === "jsonl") {
      const content = fs.readFileSync(filePath, "utf-8");
      return content.trim().split("\n").filter(Boolean).length;
    }
    if (format === "csv" || format === "tsv") {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      return Math.max(0, lines.length - 1); // subtract header
    }
    if (format === "json") {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      if (Array.isArray(data)) return data.length;
    }
  } catch {
    // best-effort, ignore errors
  }
  return null;
}

function normalizeSplitName(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "validation" || lower === "val" || lower === "dev") return "valid";
  if (lower === "training") return "train";
  if (lower === "testing" || lower === "eval") return "test";
  return lower;
}

function detectSplitFromFilename(fileName: string): string {
  const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase();
  for (const known of KNOWN_SPLIT_NAMES) {
    if (baseName === known || baseName.startsWith(known + "_") || baseName.startsWith(known + "-") || baseName.startsWith(known + ".")) {
      return normalizeSplitName(known);
    }
  }
  return "default";
}

/**
 * Scan a single directory (non-recursive) and group files by detected split.
 */
function scanDirBySplits(
  dirPath: string,
  keyPrefix: string
): Record<string, HfDatasetManifest["splits"][string]> {
  const result: Record<string, HfDatasetManifest["splits"][string]> = {};
  const fileEntries = fs.readdirSync(dirPath, { withFileTypes: true }).filter((e) => e.isFile());

  const grouped: Record<string, typeof fileEntries> = {};
  for (const f of fileEntries) {
    const splitName = detectSplitFromFilename(f.name);
    if (!grouped[splitName]) grouped[splitName] = [];
    grouped[splitName].push(f);
  }

  for (const [splitName, files] of Object.entries(grouped)) {
    const key = keyPrefix ? `${keyPrefix}/${splitName}` : splitName;
    const fileInfos = files.map((f) => {
      const filePath = path.join(dirPath, f.name);
      const stat = fs.statSync(filePath);
      const format = detectFormat(f.name);
      const rows = countRowsBestEffort(filePath, format);
      return { path: f.name, format, sizeBytes: stat.size, rows };
    });

    result[key] = {
      root: dirPath,
      files: fileInfos,
      numFiles: fileInfos.length,
      numRows: fileInfos.reduce(
        (sum, f) => (f.rows !== null && sum !== null ? sum + f.rows : null),
        null as number | null
      ),
    };
  }

  return result;
}

/**
 * Scan a downloaded dataset directory and build a manifest.
 */
export function buildManifest(rootDir: string): HfDatasetManifest {
  const splits: Record<string, HfDatasetManifest["splits"][string]> = {};

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const allDirs = entries.filter((e) => e.isDirectory());

  // Classify directories
  const splitDirs = allDirs.filter((e) => KNOWN_SPLIT_NAMES.has(e.name.toLowerCase()));
  const configDirs = allDirs.filter((e) => !KNOWN_SPLIT_NAMES.has(e.name.toLowerCase()));

  // 1. Known split directories (train/, test/, etc.)
  if (splitDirs.length > 0) {
    for (const dir of splitDirs) {
      const splitName = normalizeSplitName(dir.name);
      splits[splitName] = scanSplitDir(path.join(rootDir, dir.name));
    }
  }

  // 2. Config/subset directories (e.g. wikitext-103-raw-v1/)
  //    Recurse into them and detect splits from filenames within
  if (configDirs.length > 0) {
    for (const dir of configDirs) {
      const configDir = path.join(rootDir, dir.name);
      const configEntries = fs.readdirSync(configDir, { withFileTypes: true });
      const subSplitDirs = configEntries.filter(
        (e) => e.isDirectory() && KNOWN_SPLIT_NAMES.has(e.name.toLowerCase())
      );

      if (subSplitDirs.length > 0) {
        // Config dir has explicit split subdirectories
        for (const subDir of subSplitDirs) {
          const splitName = normalizeSplitName(subDir.name);
          const key = `${dir.name}/${splitName}`;
          splits[key] = scanSplitDir(path.join(configDir, subDir.name));
        }
        // Also pick up loose files in config dir root
        if (configEntries.some((e) => e.isFile())) {
          Object.assign(splits, scanDirBySplits(configDir, dir.name));
        }
      } else {
        // Flat files within config dir — detect splits from filenames
        Object.assign(splits, scanDirBySplits(configDir, dir.name));
      }
    }
  }

  // 3. Root-level files (README.md, .gitattributes, etc.)
  const rootFiles = entries.filter((e) => e.isFile());
  if (rootFiles.length > 0) {
    if (splitDirs.length === 0 && configDirs.length === 0) {
      // Pure flat directory — detect splits from filenames
      Object.assign(splits, scanDirBySplits(rootDir, ""));
    } else {
      // Mixed: put root files into "default" split
      splits["default"] = scanSplitDir(rootDir, true);
    }
  }

  return { version: 1, splits };
}

function scanSplitDir(dirPath: string, rootOnly = false): HfDatasetManifest["splits"][string] {
  const fileInfos: HfDatasetManifest["splits"][string]["files"] = [];

  function walk(dir: string, prefix: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const stat = fs.statSync(filePath);
        const format = detectFormat(entry.name);
        const rows = countRowsBestEffort(filePath, format);
        fileInfos.push({
          path: relativePath,
          format,
          sizeBytes: stat.size,
          rows,
        });
      } else if (entry.isDirectory() && !rootOnly) {
        walk(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
      }
    }
  }

  if (rootOnly) {
    // Only scan files directly in the directory, not subdirectories
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(dirPath, entry.name);
        const stat = fs.statSync(filePath);
        const format = detectFormat(entry.name);
        const rows = countRowsBestEffort(filePath, format);
        fileInfos.push({
          path: entry.name,
          format,
          sizeBytes: stat.size,
          rows,
        });
      }
    }
  } else {
    walk(dirPath, "");
  }

  return {
    root: dirPath,
    files: fileInfos,
    numFiles: fileInfos.length,
    numRows: fileInfos.reduce(
      (sum, f) => (f.rows !== null && sum !== null ? sum + f.rows : null),
      null as number | null
    ),
  };
}

/**
 * Compute aggregate statistics from a manifest.
 */
export function computeStats(
  rootDir: string,
  manifest: HfDatasetManifest
): HfDatasetStats {
  let totalSize = 0;
  const splitStats: HfDatasetStats["splits"] = {};

  for (const [splitName, split] of Object.entries(manifest.splits)) {
    const formats: Record<string, number> = {};
    let splitSize = 0;

    for (const file of split.files) {
      splitSize += file.sizeBytes;
      formats[file.format] = (formats[file.format] || 0) + 1;
    }

    totalSize += splitSize;
    splitStats[splitName] = {
      numFiles: split.numFiles,
      numRows: split.numRows,
      formats,
    };
  }

  return {
    sizeBytes: totalSize,
    splits: splitStats,
  };
}
