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
  MAX_EXTRACT_CONTEXT: 4_000,
} as const;

/** Buffer size constants for exec calls. */
export const BUFFER = {
  /** 512 KB — grep results */
  SMALL: 512 * 1024,
  /** 1 MB — default kubectl / exec */
  DEFAULT: 1024 * 1024,
  /** 2 MB — large log collection */
  LARGE: 2 * 1024 * 1024,
} as const;

/** Research ideation constants. */
export const IDEATION = {
  /** Max output tokens per stage in quick mode. */
  TOKENS_QUICK: 600,
  /** Max output tokens per stage in full mode. */
  TOKENS_FULL: 1_500,
} as const;

/** File extensions eligible for paper study (discuss / ideate). */
export const PAPER_ELIGIBLE_EXTENSIONS = ["pdf", "md", "markdown", "txt"] as const;
