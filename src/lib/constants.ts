// ---------------------------------------------------------------------------
// Centralized numeric constants for truncation / display / limits.
// Import from here instead of using magic numbers throughout the codebase.
// ---------------------------------------------------------------------------

/** Output truncation limits for tool / exec results (server-side). */
export const TRUNCATE = {
  /** Default stdout truncation for tool output */
  STDOUT: 10_000,
  /** Default stderr truncation for tool output */
  STDERR: 5_000,
  /** Larger stdout for grep / kubectl results */
  STDOUT_LARGE: 20_000,
  /** Very large output for cluster status / pip install */
  STDOUT_MAX: 30_000,
  /** File read content truncation */
  FILE_CONTENT: 50_000,
  /** Cluster job status truncation */
  JOB_STATUS: 2_000,
  /** Directory listing max entries */
  DIR_ENTRIES: 200,
} as const;

/** Paper / article related constants. */
export const PAPER = {
  /** Max authors shown in search-tool formatted output. */
  MAX_AUTHORS_DISPLAY: 5,
  /** Max abstract length in search-tool formatted output. */
  MAX_ABSTRACT_LENGTH: 500,
  /** Max articles sent to the LLM in one summarization/roast request. */
  MAX_BATCH_SIZE: 15,
  /** Max abstract length per article when sent to the LLM for summarization. */
  MAX_ABSTRACT_CHARS: 1_500,
  /** Max chars of raw text sent to AI for metadata extraction. */
  MAX_EXTRACT_CONTEXT: 10_000,
} as const;

/** Tighter truncation limits for long-agent mode (conserve context window). */
export const TRUNCATE_LONG_AGENT = {
  STDOUT: 4_000,
  STDERR: 2_000,
  STDOUT_LARGE: 8_000,
  STDOUT_MAX: 12_000,
  FILE_CONTENT: 20_000,
  JOB_STATUS: 2_000,
  DIR_ENTRIES: 100,
} as const;

/** Pick the right truncation limits based on agent mode. */
export function getTruncateLimits(isLongAgent?: boolean): { readonly STDOUT: number; readonly STDERR: number; readonly STDOUT_LARGE: number; readonly STDOUT_MAX: number; readonly FILE_CONTENT: number; readonly JOB_STATUS: number; readonly DIR_ENTRIES: number } {
  return isLongAgent ? TRUNCATE_LONG_AGENT : TRUNCATE;
}

/** Buffer size constants for exec calls. */
export const BUFFER = {
  /** 512 KB — grep results */
  SMALL: 512 * 1024,
  /** 1 MB — default kubectl / exec */
  DEFAULT: 1024 * 1024,
  /** 2 MB — large log collection */
  LARGE: 2 * 1024 * 1024,
} as const;

/** File extensions eligible for paper study (discuss / ideate). */
export const PAPER_ELIGIBLE_EXTENSIONS = ["pdf", "md", "markdown", "txt"] as const;

// ---------------------------------------------------------------------------
// File-type extension lists — single source of truth for preview routing,
// RAG indexing, and bot file reading.
// ---------------------------------------------------------------------------

/** Plain text files (no syntax highlighting). */
export const PLAIN_TEXT_EXTS = ["txt", "log", "csv", "env", "ini", "cfg", "conf"] as const;

/** Code / structured files (syntax highlighted in CodeMirror). */
export const CODE_EXTS = [
  "json", "html", "css", "js", "ts", "tsx", "jsx",
  "py", "yaml", "yml", "xml", "toml", "sh", "bat",
  "c", "cpp", "h", "hpp", "java", "go", "rs", "rb", "php",
  "sql", "r", "scala", "kt", "swift", "dart", "lua", "pl", "pm", "groovy",
  "scss", "sass", "less", "graphql", "proto", "cmake",
] as const;

/** Map short file extensions to human-readable language display names. */
export const EXT_TO_DISPLAY: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  sass: "scss",
  yml: "yaml",
  sh: "bash",
  bat: "bash",
  rs: "rust",
  rb: "ruby",
  h: "c",
  hpp: "cpp",
  kt: "kotlin",
  pl: "perl",
  pm: "perl",
  cmake: "makefile",
  proto: "protobuf",
};

/** Molecular / chemical file formats. */
export const MOL_EXTS = ["pdb", "mol", "mol2", "sdf", "sd", "xyz", "cif"] as const;

/** 3D CAD / mesh file formats. */
export const CAD_EXTS = ["stl", "obj", "ply", "vtk", "vtp", "gltf", "glb", "fbx", "dae", "3ds", "3mf", "pcd"] as const;

/** Image file formats. */
export const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"] as const;

/**
 * All text-readable extensions (plain text + code).
 * Useful for RAG indexing and bot file reading.
 */
export const ALL_TEXT_EXTS = [...PLAIN_TEXT_EXTS, ...CODE_EXTS] as const;
