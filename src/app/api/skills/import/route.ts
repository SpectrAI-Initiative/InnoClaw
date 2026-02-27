import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { SkillExportData } from "@/types";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseSkillRow(row: Record<string, unknown>) {
  return {
    ...row,
    steps: typeof row.steps === "string" ? JSON.parse(row.steps) : null,
    allowedTools:
      typeof row.allowedTools === "string"
        ? JSON.parse(row.allowedTools)
        : null,
    parameters:
      typeof row.parameters === "string"
        ? JSON.parse(row.parameters)
        : null,
  };
}

function validateSkillData(data: unknown): data is SkillExportData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.name === "string" &&
    d.name.length > 0 &&
    typeof d.slug === "string" &&
    d.slug.length > 0 &&
    typeof d.systemPrompt === "string" &&
    d.systemPrompt.length > 0
  );
}

// --------------- GitHub helpers ---------------

interface GitHubUrlParts {
  owner: string;
  repo: string;
  branch: string;
  path: string; // empty string means repo root
}

function parseGitHubUrl(url: string): GitHubUrlParts | null {
  // Matches:
  //   https://github.com/owner/repo
  //   https://github.com/owner/repo/tree/branch
  //   https://github.com/owner/repo/tree/branch/path/to/dir
  const m = url.match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.+?))?)?(?:\/)?$/
  );
  if (!m) return null;
  return {
    owner: m[1],
    repo: m[2],
    branch: m[3] || "main",
    path: m[4] || "",
  };
}

function isGitHubUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/.test(url);
}

async function fetchRaw(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  try {
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(
        "Failed to fetch GitHub raw file: non-OK response",
        {
          url: rawUrl,
          status: res.status,
          statusText: res.statusText,
        }
      );
      return null;
    }
    return await res.text();
  } catch (error) {
    console.error("Failed to fetch GitHub raw file", { url: rawUrl, error });
    return null;
  }
}

/** Parse SKILL.md YAML frontmatter + markdown body into a SkillExportData */
function parseSkillMd(
  content: string,
  fallbackSlug: string
): SkillExportData | null {
  // Match --- frontmatter --- body
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    // No frontmatter — treat entire content as system prompt
    return {
      name: fallbackSlug,
      slug: fallbackSlug,
      description: null,
      systemPrompt: content.trim(),
      steps: null,
      allowedTools: null,
      parameters: null,
    };
  }

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  if (!body) return null;

  // Simple YAML key extraction (flat keys only)
  const getValue = (key: string): string | undefined => {
    const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m?.[1]?.trim();
  };

  const name = getValue("name") || fallbackSlug;
  const description = getValue("description") || null;

  return {
    name,
    slug: slugify(name),
    description,
    systemPrompt: body,
    steps: null,
    allowedTools: null,
    parameters: null,
  };
}

interface MarketplaceJson {
  plugins?: Array<{
    skills?: string[];
  }>;
}

/** Discover skill paths from a GitHub repo */
async function discoverSkillPaths(
  owner: string,
  repo: string,
  branch: string,
  basePath: string
): Promise<string[]> {
  // Strategy 1: Try marketplace.json
  const marketplaceContent = await fetchRaw(
    owner,
    repo,
    branch,
    ".claude-plugin/marketplace.json"
  );
  if (marketplaceContent) {
    try {
      const mp: MarketplaceJson = JSON.parse(marketplaceContent);
      const allPaths: string[] = [];
      for (const plugin of mp.plugins || []) {
        for (const p of plugin.skills || []) {
          // Normalize "./scientific-skills/rdkit" → "scientific-skills/rdkit"
          allPaths.push(p.replace(/^\.\//, ""));
        }
      }
      if (allPaths.length > 0) return allPaths;
    } catch {
      // ignore parse errors, fall through
    }
  }

  // Strategy 2: List directory via GitHub API (for repos without marketplace.json)
  const apiPath = basePath || "";
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${apiPath}?ref=${branch}`;
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    const ghToken = process.env.GITHUB_TOKEN;
    if (ghToken) {
      headers["Authorization"] = `Bearer ${ghToken}`;
    }
    const res = await fetch(apiUrl, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];

    const items: Array<{ name: string; type: string; path: string }> =
      await res.json();
    // Return directories (each might contain a SKILL.md)
    return items
      .filter((i) => i.type === "dir")
      .map((i) => i.path);
  } catch {
    return [];
  }
}

/** Batch helper: process items with a concurrency limit */
async function batchProcess<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/** Import a single SkillExportData into the DB, returns the inserted skill id or null */
async function insertSkill(
  data: SkillExportData,
  workspaceId: string | null
): Promise<string | null> {
  const normalizedSlug = slugify(data.slug);

  // Deduplicate slug
  let finalSlug = normalizedSlug;
  let attempt = 0;
  while (true) {
    const existing = await db
      .select()
      .from(skills)
      .where(
        and(
          eq(skills.slug, finalSlug),
          workspaceId
            ? eq(skills.workspaceId, workspaceId)
            : isNull(skills.workspaceId)
        )
      )
      .limit(1);

    if (existing.length === 0) break;
    attempt++;
    finalSlug = `${normalizedSlug}-${attempt}`;
  }

  const id = nanoid();
  const now = new Date().toISOString();

  await db.insert(skills).values({
    id,
    workspaceId: workspaceId || null,
    name: data.name,
    slug: finalSlug,
    description: data.description || null,
    systemPrompt: data.systemPrompt,
    steps: data.steps ? JSON.stringify(data.steps) : null,
    allowedTools: data.allowedTools
      ? JSON.stringify(data.allowedTools)
      : null,
    parameters: data.parameters
      ? JSON.stringify(data.parameters)
      : null,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

// --------------- Main handler ---------------

// POST /api/skills/import
// Body: { skill: SkillExportData, workspaceId?: string }
// Or:   { url: string, workspaceId?: string }
//   - url can be a direct JSON endpoint, or a GitHub repo/directory URL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, skill: skillData, workspaceId } = body;

    // ─── Path A: GitHub repo/directory URL ───
    if (url && isGitHubUrl(url)) {
      const gh = parseGitHubUrl(url);
      if (!gh) {
        return NextResponse.json(
          { error: "Could not parse GitHub URL" },
          { status: 400 }
        );
      }

      // Check if URL points to a single skill directory (has SKILL.md)
      const singlePath = gh.path
        ? `${gh.path}/SKILL.md`
        : null;

      if (singlePath) {
        const content = await fetchRaw(
          gh.owner,
          gh.repo,
          gh.branch,
          singlePath
        );
        if (content) {
          const dirName = gh.path.split("/").pop() || gh.path;
          const parsed = parseSkillMd(content, dirName);
          if (parsed) {
            const id = await insertSkill(parsed, workspaceId || null);
            if (id) {
              const skill = await db
                .select()
                .from(skills)
                .where(eq(skills.id, id))
                .limit(1);
              return NextResponse.json(
                {
                  batch: true,
                  imported: 1,
                  failed: 0,
                  skills: [parseSkillRow(skill[0])],
                },
                { status: 201 }
              );
            }
          }
        }
        // If SKILL.md not found at this path, fall through to discovery
      }

      // Discover all skills in the repo
      const skillPaths = await discoverSkillPaths(
        gh.owner,
        gh.repo,
        gh.branch,
        gh.path
      );

      if (skillPaths.length === 0) {
        return NextResponse.json(
          {
            error:
              "No skills found in this GitHub repository. Expected SKILL.md files in subdirectories.",
          },
          { status: 400 }
        );
      }

      let imported = 0;
      let failed = 0;
      const importedNames: string[] = [];

      await batchProcess(skillPaths, 10, async (skillPath) => {
        try {
          const content = await fetchRaw(
            gh.owner,
            gh.repo,
            gh.branch,
            `${skillPath}/SKILL.md`
          );
          if (!content) {
            failed++;
            return;
          }

          const dirName = skillPath.split("/").pop() || skillPath;
          const parsed = parseSkillMd(content, dirName);
          if (!parsed) {
            failed++;
            return;
          }

          const id = await insertSkill(parsed, workspaceId || null);
          if (id) {
            imported++;
            importedNames.push(parsed.name);
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      });

      return NextResponse.json(
        { batch: true, imported, failed, skills: importedNames },
        { status: 201 }
      );
    }

    // ─── Path B: Direct JSON URL ───
    let importData: unknown;

    if (url) {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${res.status} ${res.statusText}` },
          { status: 400 }
        );
      }
      try {
        importData = await res.json();
      } catch {
        return NextResponse.json(
          { error: "URL did not return valid JSON" },
          { status: 400 }
        );
      }
    } else if (skillData) {
      importData = skillData;
    } else {
      return NextResponse.json(
        { error: "Missing 'url' or 'skill' in request body" },
        { status: 400 }
      );
    }

    // Validate the imported data
    if (!validateSkillData(importData)) {
      return NextResponse.json(
        {
          error:
            "Invalid skill definition: missing required fields (name, slug, systemPrompt)",
        },
        { status: 400 }
      );
    }

    const id = await insertSkill(importData, workspaceId || null);
    const skill = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id!))
      .limit(1);

    return NextResponse.json(parseSkillRow(skill[0]), { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import skill";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
