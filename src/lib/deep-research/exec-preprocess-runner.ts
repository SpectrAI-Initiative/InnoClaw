// =============================================================
// Execution Pipeline — Preprocessing Runner
// =============================================================
// Executes preprocessing pipelines step-by-step with caching,
// skip-if-exists, and per-step tracking.

import * as crypto from "crypto";
import type {
  ExperimentSpec,
  PreprocessingPipelineSpec,
  PreprocessingStepSpec,
  PreprocessingStepResult,
  PreprocessingRunResult,
  ExecutionPipelineConfig,
} from "./types";

// -------------------------------------------------------------------
// Config hashing (for cache invalidation)
// -------------------------------------------------------------------

/**
 * Hash a step's config to detect changes.
 */
export function hashStepConfig(step: PreprocessingStepSpec): string {
  const data = JSON.stringify({
    name: step.name,
    type: step.type,
    config: step.config,
    version: step.version ?? "1",
  });
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
}

/**
 * Hash an entire pipeline config.
 */
export function hashPipelineConfig(pipeline: PreprocessingPipelineSpec): string {
  const data = JSON.stringify({
    steps: pipeline.steps.map(s => ({
      name: s.name,
      type: s.type,
      config: s.config,
      version: s.version,
    })),
    outputFormat: pipeline.outputFormat,
  });
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
}

// -------------------------------------------------------------------
// Step execution helpers
// -------------------------------------------------------------------

export type FileExistenceChecker = (path: string) => boolean;
export type CommandRunner = (cmd: string, opts?: { timeout?: number }) => Promise<{ stdout: string; exitCode: number }>;
export type HashReader = (path: string) => string | null;

let fileExists: FileExistenceChecker = defaultFileExists;
let runCommand: CommandRunner = defaultRunCommand;
let readHash: HashReader = defaultReadHash;

export function setFileChecker(checker: FileExistenceChecker): void { fileExists = checker; }
export function setCommandRunner(runner: CommandRunner): void { runCommand = runner; }
export function setHashReader(reader: HashReader): void { readHash = reader; }

export function resetRunnerOverrides(): void {
  fileExists = defaultFileExists;
  runCommand = defaultRunCommand;
  readHash = defaultReadHash;
}

function defaultFileExists(path: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    return fs.existsSync(path);
  } catch { return false; }
}

async function defaultRunCommand(
  cmd: string,
  opts?: { timeout?: number },
): Promise<{ stdout: string; exitCode: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { exec } = require("child_process");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { promisify } = require("util");
  const execAsync = promisify(exec);
  try {
    const { stdout } = await execAsync(cmd, {
      timeout: opts?.timeout ?? 1800_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: stdout ?? "", exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { code?: number; stderr?: string; message?: string };
    return { stdout: err.stderr ?? err.message ?? "Unknown error", exitCode: err.code ?? 1 };
  }
}

function defaultReadHash(path: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    return fs.readFileSync(path, "utf-8").trim();
  } catch { return null; }
}

// -------------------------------------------------------------------
// Step command builder
// -------------------------------------------------------------------

/**
 * Build the shell command for a single preprocessing step.
 */
export function buildStepCommand(
  step: PreprocessingStepSpec,
  inputPath: string,
  outputPath: string,
  outputFormat: string,
): string {
  switch (step.type) {
    case "filter":
      return buildFilterCommand(step, inputPath, outputPath, outputFormat);
    case "transform":
      return buildTransformCommand(step, inputPath, outputPath, outputFormat);
    case "dedup":
      return buildDedupCommand(step, inputPath, outputPath);
    case "split":
      return buildSplitCommand(step, inputPath, outputPath);
    case "sample":
      return buildSampleCommand(step, inputPath, outputPath);
    case "tokenize":
      return buildTokenizeCommand(step, inputPath, outputPath);
    case "validate":
      return buildValidateCommand(step, inputPath, outputPath);
    case "custom":
      return buildCustomCommand(step, inputPath, outputPath);
    default:
      return `echo "Unknown step type: ${step.type}" && exit 1`;
  }
}

function buildFilterCommand(step: PreprocessingStepSpec, inputPath: string, outputPath: string, _format: string): string {
  const field = (step.config.field as string) ?? "text";
  const minLen = (step.config.minLength as number) ?? 0;
  const maxLen = (step.config.maxLength as number) ?? 1_000_000;
  return `python3 -c "
import json, os
os.makedirs(os.path.dirname('${outputPath}'), exist_ok=True)
kept, dropped = 0, 0
with open('${inputPath}') as fin, open('${outputPath}', 'w') as fout:
    for line in fin:
        rec = json.loads(line)
        val = rec.get('${field}', '')
        if ${minLen} <= len(val) <= ${maxLen}:
            fout.write(line)
            kept += 1
        else:
            dropped += 1
print(f'Filter: kept={kept}, dropped={dropped}')
"`;
}

function buildTransformCommand(step: PreprocessingStepSpec, inputPath: string, outputPath: string, _format: string): string {
  const operations = (step.config.operations as string[]) ?? [];
  const opStr = operations.map(op => {
    if (op === "lowercase") return "rec['text'] = rec.get('text', '').lower()";
    if (op === "strip") return "rec['text'] = rec.get('text', '').strip()";
    if (op === "normalize_whitespace") return "import re; rec['text'] = re.sub(r'\\\\s+', ' ', rec.get('text', ''))";
    return `pass  # Unknown op: ${op}`;
  }).join("\n        ");
  return `python3 -c "
import json, os
os.makedirs(os.path.dirname('${outputPath}'), exist_ok=True)
count = 0
with open('${inputPath}') as fin, open('${outputPath}', 'w') as fout:
    for line in fin:
        rec = json.loads(line)
        ${opStr}
        fout.write(json.dumps(rec) + '\\n')
        count += 1
print(f'Transform: processed={count}')
"`;
}

function buildDedupCommand(step: PreprocessingStepSpec, inputPath: string, outputPath: string): string {
  const fields = (step.config.fields as string[]) ?? ["text"];
  const method = (step.config.method as string) ?? "exact";
  return `python3 -c "
import json, hashlib, os
os.makedirs(os.path.dirname('${outputPath}'), exist_ok=True)
seen = set()
kept, dupes = 0, 0
with open('${inputPath}') as fin, open('${outputPath}', 'w') as fout:
    for line in fin:
        rec = json.loads(line)
        key_parts = [str(rec.get(f, '')) for f in ${JSON.stringify(fields)}]
        key = hashlib.md5('|'.join(key_parts).encode()).hexdigest()
        if key not in seen:
            seen.add(key)
            fout.write(line)
            kept += 1
        else:
            dupes += 1
print(f'Dedup (${method}): kept={kept}, dupes={dupes}')
"`;
}

function buildSplitCommand(step: PreprocessingStepSpec, inputPath: string, outputDir: string): string {
  const trainRatio = (step.config.trainRatio as number) ?? 0.9;
  const valRatio = (step.config.valRatio as number) ?? 0.05;
  const seed = (step.config.seed as number) ?? 42;
  return `python3 -c "
import json, random, os
os.makedirs('${outputDir}', exist_ok=True)
random.seed(${seed})
lines = open('${inputPath}').readlines()
random.shuffle(lines)
n = len(lines)
train_end = int(n * ${trainRatio})
val_end = train_end + int(n * ${valRatio})
splits = {'train': lines[:train_end], 'val': lines[train_end:val_end], 'test': lines[val_end:]}
for name, data in splits.items():
    with open(f'${outputDir}/{name}.jsonl', 'w') as f:
        f.writelines(data)
    print(f'{name}: {len(data)} records')
print(f'Total: {n} records')
"`;
}

function buildSampleCommand(step: PreprocessingStepSpec, inputPath: string, outputPath: string): string {
  const n = (step.config.n as number) ?? 1000;
  const seed = (step.config.seed as number) ?? 42;
  return `python3 -c "
import random, os
os.makedirs(os.path.dirname('${outputPath}'), exist_ok=True)
random.seed(${seed})
lines = open('${inputPath}').readlines()
sample = random.sample(lines, min(${n}, len(lines)))
with open('${outputPath}', 'w') as f:
    f.writelines(sample)
print(f'Sampled {len(sample)} from {len(lines)}')
"`;
}

function buildTokenizeCommand(step: PreprocessingStepSpec, inputPath: string, outputPath: string): string {
  const tokenizer = (step.config.tokenizer as string) ?? "gpt2";
  return `python3 -c "
from transformers import AutoTokenizer
import json, os
os.makedirs(os.path.dirname('${outputPath}'), exist_ok=True)
tok = AutoTokenizer.from_pretrained('${tokenizer}')
count = 0
with open('${inputPath}') as fin, open('${outputPath}', 'w') as fout:
    for line in fin:
        rec = json.loads(line)
        tokens = tok.encode(rec.get('text', ''))
        rec['token_ids'] = tokens
        rec['token_count'] = len(tokens)
        fout.write(json.dumps(rec) + '\\n')
        count += 1
print(f'Tokenized: {count} records with {tokenizer}')
"`;
}

function buildValidateCommand(step: PreprocessingStepSpec, inputPath: string, outputPath: string): string {
  const requiredFields = (step.config.requiredFields as string[]) ?? [];
  return `python3 -c "
import json, os, sys
os.makedirs(os.path.dirname('${outputPath}'), exist_ok=True)
required = ${JSON.stringify(requiredFields)}
valid, invalid = 0, 0
with open('${inputPath}') as fin, open('${outputPath}', 'w') as fout:
    for i, line in enumerate(fin):
        rec = json.loads(line)
        if all(f in rec for f in required):
            fout.write(line)
            valid += 1
        else:
            invalid += 1
print(f'Validate: valid={valid}, invalid={invalid}')
if invalid > valid:
    print('WARNING: more invalid than valid records', file=sys.stderr)
"`;
}

function buildCustomCommand(step: PreprocessingStepSpec, inputPath: string, outputPath: string): string {
  const script = (step.config.script as string) ?? "echo 'No script specified'";
  return `INPUT_PATH="${inputPath}" OUTPUT_PATH="${outputPath}" bash -c '${script}'`;
}

// -------------------------------------------------------------------
// Pipeline execution
// -------------------------------------------------------------------

/**
 * Execute a full preprocessing pipeline for an experiment.
 */
export async function executePreprocessingPipeline(
  spec: ExperimentSpec,
  config: ExecutionPipelineConfig,
): Promise<PreprocessingRunResult> {
  const pipeline = spec.preprocessing;
  const steps: PreprocessingStepResult[] = [];
  const startTime = Date.now();

  if (!pipeline.enabled || pipeline.steps.length === 0) {
    return {
      experimentId: spec.experimentId,
      pipelineName: spec.name,
      steps: [],
      overallStatus: "skipped",
      totalDurationMs: 0,
      outputPath: pipeline.outputPath,
    };
  }

  // Sort steps by order
  const sortedSteps = [...pipeline.steps].sort((a, b) => a.order - b.order);

  // Determine the input path chain: first step reads from data source, subsequent steps read from previous output
  let currentInputPath = spec.dataSources[0]?.cachePath ?? pipeline.outputPath;

  for (const step of sortedSteps) {
    const stepOutputPath = step.outputPath ?? `${pipeline.outputPath}/step_${step.order}_${step.name}`;
    const configHash = hashStepConfig(step);
    const hashFile = `${stepOutputPath}/.config_hash`;

    // Check if step can be skipped
    if (config.skipExistingPreprocessing && pipeline.skipIfCached) {
      const existingHash = readHash(hashFile);
      if (existingHash === configHash && fileExists(stepOutputPath)) {
        steps.push({
          stepName: step.name,
          order: step.order,
          status: "skipped",
          inputPath: currentInputPath,
          outputPath: stepOutputPath,
          skippedReason: "Output exists and config unchanged",
          configHash,
        });
        currentInputPath = stepOutputPath;
        continue;
      }
    }

    // Execute step
    const stepStart = Date.now();
    const command = buildStepCommand(step, currentInputPath, stepOutputPath, pipeline.outputFormat);

    try {
      const { stdout, exitCode } = await runCommand(command, { timeout: 3600_000 });

      if (exitCode !== 0) {
        steps.push({
          stepName: step.name,
          order: step.order,
          status: "failed",
          inputPath: currentInputPath,
          outputPath: stepOutputPath,
          error: `Step failed (exit ${exitCode}): ${stdout.slice(0, 500)}`,
          durationMs: Date.now() - stepStart,
          configHash,
        });

        // Pipeline stops on failure
        return {
          experimentId: spec.experimentId,
          pipelineName: spec.name,
          steps,
          overallStatus: "failed",
          totalDurationMs: Date.now() - startTime,
          outputPath: pipeline.outputPath,
        };
      }

      // Parse record counts from stdout if available
      const recordsMatch = stdout.match(/(\d+)\s+records?/i);
      const recordsOut = recordsMatch ? parseInt(recordsMatch[1]) : undefined;

      steps.push({
        stepName: step.name,
        order: step.order,
        status: "completed",
        inputPath: currentInputPath,
        outputPath: stepOutputPath,
        recordsOut,
        durationMs: Date.now() - stepStart,
        configHash,
      });

      currentInputPath = stepOutputPath;
    } catch (error) {
      steps.push({
        stepName: step.name,
        order: step.order,
        status: "failed",
        inputPath: currentInputPath,
        outputPath: stepOutputPath,
        error: error instanceof Error ? error.message : "Step execution failed",
        durationMs: Date.now() - stepStart,
        configHash,
      });

      return {
        experimentId: spec.experimentId,
        pipelineName: spec.name,
        steps,
        overallStatus: "failed",
        totalDurationMs: Date.now() - startTime,
        outputPath: pipeline.outputPath,
      };
    }
  }

  return {
    experimentId: spec.experimentId,
    pipelineName: spec.name,
    steps,
    overallStatus: steps.every(s => s.status === "completed" || s.status === "skipped") ? "completed" : "failed",
    totalDurationMs: Date.now() - startTime,
    outputPath: pipeline.outputPath,
  };
}

/**
 * Generate a preprocessing manifest (for reproducibility).
 */
export function generatePreprocessingManifest(
  result: PreprocessingRunResult,
  pipeline: PreprocessingPipelineSpec,
): Record<string, unknown> {
  return {
    experimentId: result.experimentId,
    pipelineName: result.pipelineName,
    pipelineConfigHash: hashPipelineConfig(pipeline),
    overallStatus: result.overallStatus,
    totalDurationMs: result.totalDurationMs,
    outputPath: result.outputPath,
    steps: result.steps.map(s => ({
      name: s.stepName,
      order: s.order,
      status: s.status,
      inputPath: s.inputPath,
      outputPath: s.outputPath,
      recordsOut: s.recordsOut,
      durationMs: s.durationMs,
      configHash: s.configHash,
      skippedReason: s.skippedReason,
      error: s.error,
    })),
    createdAt: new Date().toISOString(),
  };
}
