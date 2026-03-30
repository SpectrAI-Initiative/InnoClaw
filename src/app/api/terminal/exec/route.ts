import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { z } from "zod";
import { validatePath } from "@/lib/files/filesystem";
import { buildSafeExecEnv, resolveHome } from "@/lib/env";

const EXEC_TIMEOUT = 30_000; // 30 seconds
const MAX_COMMAND_LENGTH = 4096;

const ExecBodySchema = z.object({
  command: z.string().min(1).max(MAX_COMMAND_LENGTH).refine(
    (s) => !s.includes("\0"),
    { message: "Invalid input: contains null bytes" }
  ),
  cwd: z.string().min(1).refine(
    (s) => !s.includes("\0"),
    { message: "Invalid input: contains null bytes" }
  ),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = ExecBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { command, cwd } = parsed.data;

    // Validate the working directory is within allowed workspace roots
    let validatedCwd: string;
    try {
      validatedCwd = validatePath(cwd);
    } catch {
      return NextResponse.json(
        { error: "Access denied: working directory is outside allowed roots" },
        { status: 403 }
      );
    }

    // Handle `cd` command specially — resolve the new cwd and return it
    const trimmed = command.trim();
    const cdMatch = trimmed.match(/^cd\s+(.*)/);
    if (cdMatch || trimmed === "cd") {
      let target = cdMatch
        ? cdMatch[1].trim().replace(/^["']|["']$/g, "")
        : resolveHome();

      // Expand a leading "~" to the user's home directory
      if (target.startsWith("~")) {
        const homeDir = resolveHome();
        const restWithoutSep = target.slice(1).replace(/^[/\\]+/, "");
        target = path.join(homeDir, restWithoutSep);
      }

      const newCwd = path.resolve(validatedCwd, target);

      try {
        validatePath(newCwd);
        // Verify the directory exists
        const fs = await import("fs/promises");
        const stat = await fs.stat(newCwd);
        if (!stat.isDirectory()) {
          return NextResponse.json({
            stdout: "",
            stderr: `cd: not a directory: ${target}`,
            exitCode: 1,
            cwd: validatedCwd,
          });
        }
        return NextResponse.json({
          stdout: "",
          stderr: "",
          exitCode: 0,
          cwd: newCwd,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "No such directory";
        return NextResponse.json({
          stdout: "",
          stderr: `cd: ${message}`,
          exitCode: 1,
          cwd: validatedCwd,
        });
      }
    }

    // Execute the command with a sanitized environment
    const safeEnv = buildSafeExecEnv();

    const result = await new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>((resolve) => {
      exec(
        command,
        {
          cwd: validatedCwd,
          timeout: EXEC_TIMEOUT,
          maxBuffer: 1024 * 1024, // 1MB
          env: safeEnv,
        },
        (error, stdout, stderr) => {
          resolve({
            stdout: stdout || "",
            stderr: stderr || "",
            exitCode: error?.code ?? (error ? 1 : 0),
          });
        }
      );
    });

    return NextResponse.json({
      ...result,
      cwd: validatedCwd,
    });
  } catch (error) {
    console.error("Terminal exec error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execution failed" },
      { status: 500 }
    );
  }
}
