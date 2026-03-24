import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { SkillExportData } from "@/types";
import { parseSkillRow } from "@/lib/db/skills-utils";
import { insertSkill, parseSkillMd } from "@/lib/db/skills-insert";
import {
  isGitHubUrl,
  parseGitHubUrl,
  getGitHubFallbackSlug,
} from "@/lib/skills/github-import";
import {
  resolveGitHubRepo,
  fetchRaw,
  batchProcess,
  MAX_FETCH_BYTES,
} from "@/lib/skills/github-fetch";

/** Check if a hostname/IP is private, loopback, or internal */
function isPrivateOrInternalHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.")
  ) {
    return true;
  }

  const m172 = hostname.match(/^172\.(\d+)\./);
  if (m172) {
    const octet = parseInt(m172[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }

  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    /^fe[89ab]/i.test(lower) ||
    lower.startsWith("::ffff:127.") ||
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:192.168.") ||
    lower.startsWith("::ffff:169.254.")
  ) {
    return true;
  }

  const m172mapped = lower.match(/^::ffff:172\.(\d+)\./);
  if (m172mapped) {
    const octet = parseInt(m172mapped[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }

  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return true;
  }

  return false;
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

// --------------- Main handler ---------------

// POST /api/skills/import
// Body: { skill: SkillExportData, workspaceId?: string }
// Or:   { url: string, workspaceId?: string }
// Or:   { url: string, paths: string[], branch: string, workspaceId?: string }  (selective import)
//   - url can be a direct JSON endpoint, or a GitHub repo/directory URL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, skill: skillData, workspaceId, paths, branch } = body;

    // ─── Path A: Selective GitHub import (from preview) ───
    if (url && isGitHubUrl(url) && Array.isArray(paths) && branch) {
      const gh = parseGitHubUrl(url);
      if (!gh) {
        return NextResponse.json(
          { error: "Could not parse GitHub URL" },
          { status: 400 }
        );
      }

      let imported = 0;
      let failed = 0;
      const importedNames: string[] = [];

      await batchProcess(paths as string[], 3, async (filePath: string) => {
        try {
          const content = await fetchRaw(
            gh.owner,
            gh.repo,
            branch as string,
            filePath
          );
          if (!content) {
            failed++;
            return;
          }

          const fallbackSlug = getGitHubFallbackSlug(filePath, gh.repo);
          const parsed = parseSkillMd(content, fallbackSlug);
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

    // ─── Path B: GitHub repo/directory URL (full discovery import) ───
    if (url && isGitHubUrl(url)) {
      const resolved = await resolveGitHubRepo(url);
      if (!resolved) {
        return NextResponse.json(
          {
            error:
              "No skills found in this GitHub repository. Expected SKILL.md, commands/*.md, or agents/*.md files.",
          },
          { status: 400 }
        );
      }

      // Single file
      if (resolved.singleFile) {
        const parsed = parseSkillMd(
          resolved.singleFile.content,
          resolved.singleFile.fallbackSlug
        );
        if (!parsed) {
          return NextResponse.json(
            { error: "Failed to parse skill file" },
            { status: 400 }
          );
        }

        const id = await insertSkill(parsed, workspaceId || null);
        if (!id) {
          return NextResponse.json(
            { error: "Failed to create skill" },
            { status: 500 }
          );
        }

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

      // Multiple files
      let imported = 0;
      let failed = 0;
      const importedNames: string[] = [];

      await batchProcess(resolved.contentFiles, 3, async (file) => {
        try {
          const content = await fetchRaw(
            resolved.owner,
            resolved.repo,
            resolved.branch,
            file.path
          );
          if (!content) {
            failed++;
            return;
          }

          const parsed = parseSkillMd(content, file.fallbackSlug);
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

    // ─── Path C: Direct JSON URL ───
    let importData: unknown;

    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") {
          return NextResponse.json(
            { error: "Only HTTPS URLs are allowed" },
            { status: 400 }
          );
        }
        const hostname = parsed.hostname;
        if (isPrivateOrInternalHost(hostname)) {
          return NextResponse.json(
            {
              error:
                "URLs pointing to private or internal addresses are not allowed",
            },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        redirect: "manual",
      });

      if (res.status >= 300 && res.status < 400) {
        return NextResponse.json(
          { error: "URL redirects are not allowed for security reasons" },
          { status: 400 }
        );
      }
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${res.status} ${res.statusText}` },
          { status: 400 }
        );
      }

      const contentLengthHeader = res.headers.get("content-length");
      if (contentLengthHeader) {
        const contentLength = Number.parseInt(contentLengthHeader, 10);
        if (!Number.isNaN(contentLength) && contentLength > MAX_FETCH_BYTES) {
          return NextResponse.json(
            { error: "Response too large" },
            { status: 400 }
          );
        }
      }

      try {
        const bodyText = await res.text();
        if (bodyText.length > MAX_FETCH_BYTES) {
          return NextResponse.json(
            { error: "Response too large" },
            { status: 400 }
          );
        }
        importData = JSON.parse(bodyText);
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
    if (!id) {
      return NextResponse.json(
        { error: "Failed to create skill" },
        { status: 500 }
      );
    }
    const skill = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id))
      .limit(1);

    return NextResponse.json(parseSkillRow(skill[0]), { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import skill";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
