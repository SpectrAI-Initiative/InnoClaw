import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { insertSkill, parseSkillMd } from "@/lib/db/skills-insert";

/** Resolve the Claude Code config directory.
 *  Defaults to ~/.claude but can be overridden via the request body,
 *  while still remaining within the ~/.claude directory tree. */
const DEFAULT_CLAUDE_DIR = path.join(os.homedir(), ".claude");

function resolveClaudeDir(customPath?: string): string {
  if (customPath) {
    // Resolve relative to home dir if path starts with ~
    if (customPath === "~") {
      return os.homedir();
    }
    if (
      customPath.startsWith("~" + path.sep) ||
      customPath.startsWith("~/") ||
      customPath.startsWith("~\\")
    ) {
      // Strip leading "~/", "~\" or "~" + path.sep before joining
      const relativeFromHome = customPath.slice(2);
      return path.join(os.homedir(), relativeFromHome);
    }
    if (customPath.startsWith("~")) {
      // Fallback: treat anything else starting with "~" as relative to home
      return path.join(os.homedir(), customPath.slice(1));
    }
    return path.resolve(customPath);
  }
  return DEFAULT_CLAUDE_DIR;
}

/** Ensure the target directory stays within the allowed Claude directory tree. */
function isWithinClaudeDir(targetDir: string): boolean {
  const base = path.resolve(DEFAULT_CLAUDE_DIR);
  const target = path.resolve(targetDir);

  // Normalize case on Windows by comparing lowercase strings.
  const baseNorm = process.platform === "win32" ? base.toLowerCase() : base;
  const targetNorm = process.platform === "win32" ? target.toLowerCase() : target;

  return (
    targetNorm === baseNorm ||
    targetNorm.startsWith(baseNorm + path.sep)
  );
}

/** Safely read a file, returning null on any error */
async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/** Discover importable skill files inside a Claude Code config directory */
async function discoverClaudeSkills(
  claudeDir: string
): Promise<Array<{ filePath: string; slug: string }>> {
  const results: Array<{ filePath: string; slug: string }> = [];

  // Scan ~/.claude/commands/*.md
  const commandsDir = path.join(claudeDir, "commands");
  try {
    const entries = await fs.readdir(commandsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const slug = entry.name.replace(/\.md$/, "");
        results.push({ filePath: path.join(commandsDir, entry.name), slug });
      }
    }
  } catch {
    // directory doesn't exist or is not readable — skip
  }

  // Scan ~/.claude/skills/*/SKILL.md
  const skillsDir = path.join(claudeDir, "skills");
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
        try {
          await fs.access(skillFile);
          results.push({ filePath: skillFile, slug: entry.name });
        } catch {
          // SKILL.md doesn't exist in this subdirectory — skip
        }
      }
    }
  } catch {
    // directory doesn't exist or is not readable — skip
  }

  return results;
}

// POST /api/skills/claude-import
// Body: { claudePath?: string, workspaceId?: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { claudePath, workspaceId } = body as {
      claudePath?: string;
      workspaceId?: string | null;
    };

    const claudeDir = resolveClaudeDir(claudePath);

    // Security: reject paths that aren't absolute, contain null bytes, or
    // escape the allowed ~/.claude directory tree.
    if (
      !path.isAbsolute(claudeDir) ||
      claudeDir.includes("\0") ||
      !isWithinClaudeDir(claudeDir)
    ) {
      return NextResponse.json(
        { error: "Invalid Claude Code path" },
        { status: 400 }
      );
    }

    const skillFiles = await discoverClaudeSkills(claudeDir);

    if (skillFiles.length === 0) {
      return NextResponse.json(
        {
          batch: true,
          imported: 0,
          failed: 0,
          skills: [],
          claudeDir,
        },
        { status: 200 }
      );
    }

    let imported = 0;
    let failed = 0;
    const importedNames: string[] = [];

    for (const { filePath, slug } of skillFiles) {
      const content = await readFileSafe(filePath);
      if (!content) {
        failed++;
        continue;
      }

      const parsed = parseSkillMd(content, slug);
      if (!parsed) {
        failed++;
        continue;
      }

      const id = await insertSkill(parsed, workspaceId || null);
      if (id) {
        imported++;
        importedNames.push(parsed.name);
      } else {
        failed++;
      }
    }

    return NextResponse.json(
      { batch: true, imported, failed, skills: importedNames, claudeDir },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import Claude Code skills";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/skills/claude-import?path=...
// Returns discovered skill files without importing (preview)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const claudePath = searchParams.get("path") || undefined;
    const claudeDir = resolveClaudeDir(claudePath);

    if (
      !path.isAbsolute(claudeDir) ||
      claudeDir.includes("\0") ||
      !isWithinClaudeDir(claudeDir)
    ) {
      return NextResponse.json(
        { error: "Invalid Claude Code path" },
        { status: 400 }
      );
    }

    const skillFiles = await discoverClaudeSkills(claudeDir);

    return NextResponse.json({
      claudeDir,
      files: skillFiles.map((f) => ({
        slug: f.slug,
        path: path.relative(claudeDir, f.filePath),
      })),
      count: skillFiles.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan Claude Code directory";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
