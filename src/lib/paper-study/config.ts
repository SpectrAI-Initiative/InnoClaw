/**
 * Paper Study configuration system.
 *
 * Supports:
 * - Default config (built-in)
 * - Project-level config via `paper-study-config.json` in project root
 * - Frontend localStorage overrides (notesDir)
 */

import { readFile, writeFile } from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaperStudyPaths {
  /** Root path of the Obsidian vault (or notes directory). */
  obsidian_vault: string;
  /** Subfolder for paper notes inside the vault. */
  paper_notes_folder: string;
  /** Subfolder for concept notes. */
  concepts_folder: string;
}

export interface DailyPapersConfig {
  /** Positive keywords — title match +3, abstract match +1. */
  keywords: string[];
  /** Papers matching these are instantly rejected (score = -999). */
  negative_keywords: string[];
  /** Domain-specific boost keywords — 2+ matches +2, 1 match +1. */
  domain_boost_keywords: string[];
  /** Minimum score to pass filtering. */
  min_score: number;
  /** Maximum number of papers to keep after scoring. */
  top_n: number;
}

export interface PaperStudyConfig {
  paths: PaperStudyPaths;
  daily_papers: DailyPapersConfig;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: PaperStudyConfig = {
  paths: {
    obsidian_vault: "",
    paper_notes_folder: "论文笔记",
    concepts_folder: "_概念",
  },
  daily_papers: {
    keywords: [
      "world model",
      "diffusion model",
      "embodied ai",
      "3d gaussian splatting",
      "sim-to-real",
      "sim2real",
      "robot simulation",
      "reinforcement learning",
      "vision language action",
      "VLA",
      "manipulation",
      "locomotion",
    ],
    negative_keywords: [
      "medical imaging",
      "weather forecast",
      "climate",
      "mri",
      "ct scan",
      "pathology",
      "diagnosis",
      "protein",
      "drug discovery",
      "audio generation",
      "music generation",
      "speech synthesis",
      "text-to-speech",
      "speech recognition",
      "trading",
      "financial",
    ],
    domain_boost_keywords: [
      "robot",
      "manipulation",
      "grasping",
      "locomotion",
      "planning",
      "reinforcement learning",
      "policy learning",
      "visuomotor",
      "action prediction",
    ],
    min_score: 2,
    top_n: 30,
  },
};

// ---------------------------------------------------------------------------
// Config file path
// ---------------------------------------------------------------------------

function getConfigPath(): string {
  return path.join(process.cwd(), "paper-study-config.json");
}

// ---------------------------------------------------------------------------
// Deep merge utility
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(base: any, override: any): any {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const val = override[key];
    if (
      val !== undefined &&
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], val);
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Load the merged configuration (defaults + project file). */
export async function loadConfig(): Promise<PaperStudyConfig> {
  try {
    const raw = await readFile(getConfigPath(), "utf-8");
    const fileConfig = JSON.parse(raw) as Partial<PaperStudyConfig>;
    return deepMerge(DEFAULT_CONFIG, fileConfig);
  } catch {
    // File doesn't exist or is invalid — use defaults
    return { ...DEFAULT_CONFIG };
  }
}

/** Save configuration to the project-level config file. */
export async function saveConfig(
  config: Partial<PaperStudyConfig>
): Promise<void> {
  const current = await loadConfig();
  const merged = deepMerge(current, config);
  await writeFile(getConfigPath(), JSON.stringify(merged, null, 2), "utf-8");
}

/** Get the default configuration (no file read). */
export function getDefaultConfig(): PaperStudyConfig {
  return { ...DEFAULT_CONFIG };
}
