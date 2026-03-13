import { exec } from "child_process";
import { buildSafeExecEnv } from "@/lib/env";
import { TRUNCATE, BUFFER } from "@/lib/constants";

/** Base environment variables for all exec() calls. Shared across tool modules. */
export const baseExecEnv = buildSafeExecEnv();

/**
 * Execute a shell command in the workspace directory and return truncated output.
 * Shared helper that eliminates boilerplate across bash and grep tools.
 */
export function execInWorkspace(
  command: string,
  cwd: string,
  opts?: { timeout?: number; maxBuffer?: number; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd,
        timeout: opts?.timeout ?? 30_000,
        maxBuffer: opts?.maxBuffer ?? BUFFER.DEFAULT,
        env: { ...baseExecEnv, ...opts?.env } as NodeJS.ProcessEnv,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: (stdout || "").slice(0, TRUNCATE.STDOUT),
          stderr: (stderr || "").slice(0, TRUNCATE.STDERR),
          exitCode: error?.code ?? (error ? 1 : 0),
        });
      }
    );
  });
}

/**
 * Parse a shell-style command string into an argv array.
 * Handles single-quoted, double-quoted, and unquoted tokens.
 * Backslash escaping within double quotes is supported.
 */
export function parseShellArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (ch === "'") {
      // Single-quoted segment: take everything until closing '
      i++;
      while (i < len && input[i] !== "'") {
        current += input[i];
        i++;
      }
      i++; // skip closing '
    } else if (ch === '"') {
      // Double-quoted segment: supports backslash escaping
      i++;
      while (i < len && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < len) {
          i++;
          current += input[i];
        } else {
          current += input[i];
        }
        i++;
      }
      i++; // skip closing "
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      i++;
    } else {
      current += ch;
      i++;
    }
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}
