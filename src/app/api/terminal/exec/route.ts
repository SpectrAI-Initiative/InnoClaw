import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { validatePath } from "@/lib/files/filesystem";

const EXEC_TIMEOUT = 30_000; // 30 seconds

export async function POST(req: NextRequest) {
  try {
    const { command, cwd } = await req.json();

    if (!command || typeof command !== "string") {
      return NextResponse.json({ error: "Missing command" }, { status: 400 });
    }

    if (!cwd || typeof cwd !== "string") {
      return NextResponse.json({ error: "Missing cwd" }, { status: 400 });
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
      const target = cdMatch ? cdMatch[1].trim().replace(/^["']|["']$/g, "") : process.env.HOME || "/";
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

    // Execute the command
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
          env: { ...process.env, TERM: "dumb" },
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
