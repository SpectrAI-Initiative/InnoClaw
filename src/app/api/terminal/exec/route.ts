import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { validatePath } from "@/lib/files/filesystem";
import { buildSafeExecEnv, resolveHome } from "@/lib/env";

const EXEC_TIMEOUT = 30_000; // 30 seconds
const MAX_COMMAND_LENGTH = 4096;

export async function POST(req: NextRequest) {
  try {
    const { command, cwd } = await req.json();

    if (!command || typeof command !== "string") {
      return NextResponse.json({ error: "Missing command" }, { status: 400 });
    }

    if (!cwd || typeof cwd !== "string") {
      return NextResponse.json({ error: "Missing cwd" }, { status: 400 });
    }

    // Reject null bytes and overly long commands
    if (command.includes("\0") || cwd.includes("\0")) {
      return NextResponse.json(
        { error: "Invalid input: contains null bytes" },
        { status: 400 }
      );
    }

    if (command.length > MAX_COMMAND_LENGTH) {
      return NextResponse.json(
        { error: `Command too long (max ${MAX_COMMAND_LENGTH} characters)` },
        { status: 400 }
      );
    }

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
