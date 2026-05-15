import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import { buildLaTeXPaper } from "./latex-paper-builder";
import type { BuildLaTeXPaperInput, BuildLaTeXPaperResult } from "./latex-paper-builder";

export type LatexCompileRequest = BuildLaTeXPaperInput;

export interface LatexCompilePass {
  iteration: number;
  engine: string;
  success: boolean;
  refinementNotes: string[];
  log: string;
}

export interface LatexCompilePdfResult {
  kind: "pdf";
  pdfBuffer: Buffer;
  paper: BuildLaTeXPaperResult;
  engine: string;
  passes: LatexCompilePass[];
}

export interface LatexCompileFallbackResult {
  kind: "fallback";
  paper: BuildLaTeXPaperResult;
  reason: string;
  hint: string;
  passes: LatexCompilePass[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isExecutableAvailable(command: string): boolean {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function getLatexEngineCandidates(hasCJK: boolean): string[] {
  return hasCJK
    ? ["xelatex", "lualatex", "pdflatex"]
    : ["pdflatex", "xelatex", "lualatex"];
}

function stripPackageUseLine(texContent: string, packageName: string): string {
  const pattern = new RegExp(
    String.raw`^\s*\\usepackage(?:\[[^\]]*\])?\{${escapeRegExp(packageName)}\}\s*$`,
    "gm",
  );
  return texContent.replace(pattern, "% removed unavailable package: " + packageName);
}

export function refineLatexSourceForCompilation(
  texContent: string,
  log: string,
): { texContent: string; notes: string[] } {
  const notes: string[] = [];
  let refined = texContent;

  const missingPackages = new Set<string>();
  for (const match of log.matchAll(/(?:LaTeX Error:\s*)?File `([^']+)\.sty' not found\./g)) {
    missingPackages.add(match[1]);
  }

  for (const packageName of missingPackages) {
    const next = stripPackageUseLine(refined, packageName);
    if (next !== refined) {
      refined = next;
      notes.push(`removed missing package ${packageName}`);
    }
  }

  return { texContent: refined, notes };
}

function createFallbackHint(hasCJK: boolean): string {
  return hasCJK
    ? "Install XeLaTeX or LuaLaTeX for CJK output, or add the missing style files."
    : "Install a TeX engine such as TeX Live / BasicTeX, or add the missing style files.";
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  maxBuffer: number,
  timeout: number,
): string {
  try {
    return String(execFileSync(command, args, {
      cwd,
      encoding: "utf-8",
      maxBuffer,
      timeout,
    }));
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string; message?: string };
    return [
      err.stdout || "",
      err.stderr || "",
      err.message ? `[${err.message}]` : "",
      err.status === undefined ? "" : `[exit ${err.status}]`,
    ].filter(Boolean).join("\n");
  }
}

function compileSequence(
  engine: string,
  cwd: string,
  paper: BuildLaTeXPaperResult,
): { log: string; success: boolean } {
  const texFilename = "paper.tex";
  const baseName = "paper";
  const logParts: string[] = [];

  rmSync(path.join(cwd, "paper.pdf"), { force: true });
  writeFileSync(path.join(cwd, texFilename), paper.texContent, "utf-8");
  writeFileSync(path.join(cwd, "references.bib"), paper.bibContent, "utf-8");

  logParts.push(runCommand(engine, ["-interaction=nonstopmode", texFilename], cwd, 10 * 1024 * 1024, 30000));

  if (paper.bibEntries.length > 0 && paper.bibContent.length > 0) {
    logParts.push(runCommand("bibtex", [baseName], cwd, 5 * 1024 * 1024, 15000));
  }

  for (let i = 0; i < 2; i++) {
    logParts.push(runCommand(engine, ["-interaction=nonstopmode", texFilename], cwd, 10 * 1024 * 1024, 30000));
  }

  return {
    log: logParts.join("\n"),
    success: existsSync(path.join(cwd, "paper.pdf")),
  };
}

/**
 * Compile a LaTeX paper with iterative, log-driven refinement.
 * Falls back to returning the generated .tex/.bib if no usable engine exists.
 */
export function compileLaTeXPaperToPdf(
  input: LatexCompileRequest,
): LatexCompilePdfResult | LatexCompileFallbackResult {
  const paper = buildLaTeXPaper(input);
  const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(
    [paper.title, paper.abstract, input.markdownReport.slice(0, 2000)].join("\n"),
  );
  const engines = getLatexEngineCandidates(hasCJK).filter(isExecutableAvailable);

  if (engines.length === 0) {
    return {
      kind: "fallback",
      paper,
      reason: "No TeX engine was found on this machine.",
      hint: createFallbackHint(hasCJK),
      passes: [],
    };
  }

  const tmpRoot = mkdtempSync(path.join(tmpdir(), "innoclaw-latex-"));

  let currentTex = paper.texContent;
  const passes: LatexCompilePass[] = [];

  try {
    for (let iteration = 1; iteration <= 4; iteration++) {
      let aggregatedLog = "";
      let chosenEngine = engines[0];

      for (const engine of engines) {
        const compileResult = compileSequence(engine, tmpRoot, {
          ...paper,
          texContent: currentTex,
        });
        aggregatedLog += `\n=== ${engine} ===\n${compileResult.log}`;
        chosenEngine = engine;
        if (compileResult.success) {
          const pdfBuffer = readFileSync(path.join(tmpRoot, "paper.pdf"));
          passes.push({
            iteration,
            engine: chosenEngine,
            success: true,
            refinementNotes: [],
            log: compileResult.log.slice(0, 12000),
          });
          return {
            kind: "pdf",
            pdfBuffer,
            paper: {
              ...paper,
              texContent: currentTex,
            },
            engine: chosenEngine,
            passes,
          };
        }
      }

      const { texContent: refinedTex, notes } = refineLatexSourceForCompilation(currentTex, aggregatedLog);
      passes.push({
        iteration,
        engine: chosenEngine,
        success: false,
        refinementNotes: notes,
        log: aggregatedLog.slice(0, 12000),
      });

      if (notes.length === 0) {
        break;
      }

      currentTex = refinedTex;
    }

    return {
      kind: "fallback",
      paper: {
        ...paper,
        texContent: currentTex,
      },
      reason: "Compilation failed after iterative refinement.",
      hint: createFallbackHint(hasCJK),
      passes,
    };
  } finally {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // best effort cleanup
    }
  }
}
