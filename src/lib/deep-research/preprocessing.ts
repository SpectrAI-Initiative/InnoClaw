// =============================================================
// Deep Research — Preprocessing Pipeline Specification
// =============================================================
// Pure utility module for defining and validating data preprocessing
// recipes. Generates Python commands for execution — does NOT run
// anything directly.

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export type PreprocessingFormat = "jsonl" | "parquet" | "arrow" | "csv";

export interface PreprocessingRecipe {
  id: string;
  name: string;
  inputPath: string;
  outputPath: string;
  outputFormat: PreprocessingFormat;
  steps: PreprocessingStep[];
  splitConfig?: SplitConfig;
  dedup?: DedupConfig;
  contaminationFilter?: ContaminationFilterConfig;
  sampleIdField?: string;
}

export interface PreprocessingStep {
  order: number;
  name: string;
  type: "filter" | "transform" | "normalize" | "dedup" | "split" | "sample" | "custom";
  config: Record<string, unknown>;
  description: string;
}

export interface SplitConfig {
  trainRatio: number;
  valRatio: number;
  testRatio: number;
  seed: number;
  stratifyBy?: string;
}

export interface DedupConfig {
  method: "exact" | "minhash" | "simhash";
  threshold?: number;
  fields: string[];
}

export interface ContaminationFilterConfig {
  benchmarkDatasets: string[];
  method: "ngram" | "embedding" | "exact";
  ngramSize?: number;
  threshold?: number;
}

export interface DatasetStatistics {
  totalSamples: number;
  splits: Record<string, number>;
  fields: string[];
  sampleIdCoverage: number;
  dedupRemoved?: number;
  contaminationRemoved?: number;
}

// -------------------------------------------------------------------
// Command generation
// -------------------------------------------------------------------

/**
 * Generate a Python command that runs the preprocessing pipeline.
 */
export function buildPreprocessingCommand(recipe: PreprocessingRecipe): string {
  const steps: string[] = [];

  steps.push(`import json, os, hashlib, random`);
  steps.push(`from pathlib import Path`);
  steps.push(``);
  steps.push(`INPUT_PATH = "${recipe.inputPath}"`);
  steps.push(`OUTPUT_PATH = "${recipe.outputPath}"`);
  steps.push(`OUTPUT_FORMAT = "${recipe.outputFormat}"`);
  steps.push(`os.makedirs(OUTPUT_PATH, exist_ok=True)`);
  steps.push(``);

  // Load data
  steps.push(`# Load input data`);
  steps.push(`data = []`);
  steps.push(`for f in sorted(Path(INPUT_PATH).glob("**/*.jsonl")) or [Path(INPUT_PATH)]:`);
  steps.push(`    with open(f) as fh:`);
  steps.push(`        data.extend(json.loads(line) for line in fh if line.strip())`);
  steps.push(`print(f"Loaded {len(data)} samples")`);
  steps.push(``);

  // Add sample IDs if configured
  if (recipe.sampleIdField) {
    steps.push(`# Add sample IDs`);
    steps.push(`for i, item in enumerate(data):`);
    steps.push(`    if "${recipe.sampleIdField}" not in item:`);
    steps.push(`        item["${recipe.sampleIdField}"] = f"sample_{i}"`);
    steps.push(``);
  }

  // Preprocessing steps
  for (const step of recipe.steps) {
    steps.push(`# Step ${step.order}: ${step.name} (${step.type})`);
    steps.push(`print("Running: ${step.name}")`);

    switch (step.type) {
      case "filter":
        steps.push(`data = [d for d in data if ${step.config.condition ?? "True"}]`);
        break;
      case "normalize":
        steps.push(`for d in data:`);
        steps.push(`    for key in ${JSON.stringify(step.config.fields ?? [])}:`);
        steps.push(`        if key in d and isinstance(d[key], str):`);
        steps.push(`            d[key] = d[key].strip()`);
        break;
      case "sample":
        steps.push(`random.seed(${step.config.seed ?? 42})`);
        steps.push(`data = random.sample(data, min(${step.config.n ?? "len(data)"}, len(data)))`);
        break;
      case "dedup":
        steps.push(`seen = set()`);
        steps.push(`deduped = []`);
        steps.push(`for d in data:`);
        steps.push(`    key = hashlib.md5(json.dumps(d, sort_keys=True).encode()).hexdigest()`);
        steps.push(`    if key not in seen:`);
        steps.push(`        seen.add(key)`);
        steps.push(`        deduped.append(d)`);
        steps.push(`print(f"Dedup: {len(data)} -> {len(deduped)}")`);
        steps.push(`data = deduped`);
        break;
      case "custom":
        steps.push(String(step.config.code ?? "pass"));
        break;
      default:
        steps.push(`pass  # ${step.type}: ${step.description}`);
    }

    steps.push(`print(f"After ${step.name}: {len(data)} samples")`);
    steps.push(``);
  }

  // Dedup (recipe-level)
  if (recipe.dedup) {
    steps.push(`# Recipe-level dedup (${recipe.dedup.method})`);
    steps.push(`seen = set()`);
    steps.push(`deduped = []`);
    steps.push(`for d in data:`);
    steps.push(`    key_parts = [str(d.get(f, "")) for f in ${JSON.stringify(recipe.dedup.fields)}]`);
    steps.push(`    key = hashlib.md5("|".join(key_parts).encode()).hexdigest()`);
    steps.push(`    if key not in seen:`);
    steps.push(`        seen.add(key)`);
    steps.push(`        deduped.append(d)`);
    steps.push(`print(f"Dedup removed {len(data) - len(deduped)} duplicates")`);
    steps.push(`data = deduped`);
    steps.push(``);
  }

  // Split
  if (recipe.splitConfig) {
    const sc = recipe.splitConfig;
    steps.push(`# Train/val/test split`);
    steps.push(`random.seed(${sc.seed})`);
    steps.push(`random.shuffle(data)`);
    steps.push(`n = len(data)`);
    steps.push(`n_train = int(n * ${sc.trainRatio})`);
    steps.push(`n_val = int(n * ${sc.valRatio})`);
    steps.push(`splits = {"train": data[:n_train], "val": data[n_train:n_train+n_val], "test": data[n_train+n_val:]}`);
    steps.push(`for split_name, split_data in splits.items():`);
    steps.push(`    out = Path(OUTPUT_PATH) / f"{split_name}.${recipe.outputFormat}"`);
    steps.push(`    with open(out, "w") as f:`);
    steps.push(`        for d in split_data:`);
    steps.push(`            f.write(json.dumps(d, ensure_ascii=False) + "\\n")`);
    steps.push(`    print(f"{split_name}: {len(split_data)} samples -> {out}")`);
  } else {
    // Single output
    steps.push(`# Write output`);
    steps.push(`out = Path(OUTPUT_PATH) / "data.${recipe.outputFormat}"`);
    steps.push(`with open(out, "w") as f:`);
    steps.push(`    for d in data:`);
    steps.push(`        f.write(json.dumps(d, ensure_ascii=False) + "\\n")`);
    steps.push(`print(f"Output: {len(data)} samples -> {out}")`);
  }

  // Statistics
  steps.push(``);
  steps.push(`# Write statistics`);
  steps.push(`stats = {"totalSamples": len(data), "fields": list(data[0].keys()) if data else []}`);
  steps.push(`with open(Path(OUTPUT_PATH) / "stats.json", "w") as f:`);
  steps.push(`    json.dump(stats, f, indent=2)`);
  steps.push(`print("Done.")`);

  return `python3 -c '${steps.join("\n").replace(/'/g, "'\\''")}'`;
}

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------

/**
 * Validate a preprocessing recipe for completeness.
 */
export function validateRecipe(recipe: PreprocessingRecipe): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!recipe.inputPath) errors.push("Missing inputPath");
  if (!recipe.outputPath) errors.push("Missing outputPath");
  if (!recipe.outputFormat) errors.push("Missing outputFormat");

  const validFormats: PreprocessingFormat[] = ["jsonl", "parquet", "arrow", "csv"];
  if (!validFormats.includes(recipe.outputFormat)) {
    errors.push(`Invalid outputFormat: ${recipe.outputFormat}`);
  }

  // Validate steps
  const orders = new Set<number>();
  for (const step of recipe.steps) {
    if (orders.has(step.order)) {
      errors.push(`Duplicate step order: ${step.order}`);
    }
    orders.add(step.order);

    if (!step.name) errors.push(`Step ${step.order}: missing name`);
    if (!step.type) errors.push(`Step ${step.order}: missing type`);
  }

  // Validate split config
  if (recipe.splitConfig) {
    const total = recipe.splitConfig.trainRatio + recipe.splitConfig.valRatio + recipe.splitConfig.testRatio;
    if (Math.abs(total - 1.0) > 0.01) {
      errors.push(`Split ratios sum to ${total}, expected ~1.0`);
    }
  }

  // Validate dedup config
  if (recipe.dedup) {
    if (!recipe.dedup.fields || recipe.dedup.fields.length === 0) {
      errors.push("Dedup config has no fields specified");
    }
  }

  return { valid: errors.length === 0, errors };
}

// -------------------------------------------------------------------
// Split manifest generation
// -------------------------------------------------------------------

/**
 * Generate a split manifest JSON from a recipe and statistics.
 */
export function generateSplitManifest(
  recipe: PreprocessingRecipe,
  stats: DatasetStatistics,
): Record<string, unknown> {
  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    outputPath: recipe.outputPath,
    outputFormat: recipe.outputFormat,
    totalSamples: stats.totalSamples,
    splits: stats.splits,
    fields: stats.fields,
    sampleIdField: recipe.sampleIdField ?? null,
    sampleIdCoverage: stats.sampleIdCoverage,
    dedupRemoved: stats.dedupRemoved ?? 0,
    contaminationRemoved: stats.contaminationRemoved ?? 0,
    splitConfig: recipe.splitConfig ?? null,
    generatedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------------
// Duration estimation
// -------------------------------------------------------------------

/**
 * Rough estimate of preprocessing duration based on data size and steps.
 */
export function estimatePreprocessingDuration(recipe: PreprocessingRecipe, estimatedSizeGb: number): string {
  // Base: ~1 min per GB for simple JSONL processing
  let minutes = estimatedSizeGb * 1;

  // Add time for complex steps
  for (const step of recipe.steps) {
    switch (step.type) {
      case "dedup": minutes += estimatedSizeGb * 2; break;
      case "transform": minutes += estimatedSizeGb * 0.5; break;
      case "filter": minutes += estimatedSizeGb * 0.3; break;
    }
  }

  if (recipe.dedup) minutes += estimatedSizeGb * 3;
  if (recipe.contaminationFilter) minutes += estimatedSizeGb * 5;

  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `~${Math.ceil(minutes)} min`;
  return `~${(minutes / 60).toFixed(1)} hours`;
}

// -------------------------------------------------------------------
// Default recipe
// -------------------------------------------------------------------

/**
 * Create a sensible default preprocessing recipe.
 */
export function createDefaultRecipe(
  inputPath: string,
  outputPath: string,
  format: PreprocessingFormat = "jsonl",
): PreprocessingRecipe {
  return {
    id: `recipe_${Date.now()}`,
    name: "Default preprocessing",
    inputPath,
    outputPath,
    outputFormat: format,
    steps: [
      {
        order: 1,
        name: "Normalize whitespace",
        type: "normalize",
        config: { fields: ["text", "content", "input", "output"] },
        description: "Strip and normalize whitespace in text fields",
      },
      {
        order: 2,
        name: "Remove empty samples",
        type: "filter",
        config: { condition: "len(str(d.get('text', d.get('content', '')))) > 0" },
        description: "Remove samples with empty text content",
      },
      {
        order: 3,
        name: "Exact dedup",
        type: "dedup",
        config: {},
        description: "Remove exact duplicate samples",
      },
    ],
    splitConfig: {
      trainRatio: 0.9,
      valRatio: 0.05,
      testRatio: 0.05,
      seed: 42,
    },
    sampleIdField: "sample_id",
  };
}
