/**
 * Shared utility for inserting skill data into the database.
 * Used by both the /api/skills/import and /api/skills/claude-import endpoints.
 */

import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { SkillExportData } from "@/types";
import { slugify } from "@/lib/utils/slugify";

function stripWrappingQuotes(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.replace(/^["']|["']$/g, "");
}

/** Import a single SkillExportData into the DB, returns the inserted skill id or null */
export async function insertSkill(
  data: SkillExportData,
  workspaceId: string | null
): Promise<string | null> {
  try {
    const normalizedSlug = slugify(data.slug);

    if (!normalizedSlug) {
      return null;
    }

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
  } catch (error) {
    console.error("[skills-insert] insertSkill failed:", error);
    return null;
  }
}

/** Parse skill markdown content into SkillExportData */
export function parseSkillMd(
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

  const name = stripWrappingQuotes(getValue("name")) || fallbackSlug;
  const description = stripWrappingQuotes(getValue("description"));
  const slugFromFrontmatter = stripWrappingQuotes(getValue("slug"));
  const slug = slugFromFrontmatter || fallbackSlug || slugify(name);

  // Extract allowed-tools from either a YAML list or a single-line CSV value.
  let allowedTools: string[] | null = null;
  const allowedToolsBlock = frontmatter.match(
    /^allowed-tools:\s*\n((?:\s+-\s+.+\n?)*)/m
  );
  if (allowedToolsBlock) {
    const tools = allowedToolsBlock[1]
      .split("\n")
      .map((line) => line.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean);
    if (tools.length > 0) {
      allowedTools = Array.from(new Set(tools));
    }
  } else {
    const allowedToolsRaw = getValue("allowed-tools");
    if (allowedToolsRaw) {
      const tools = allowedToolsRaw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (tools.length > 0) {
        allowedTools = Array.from(new Set(tools));
      }
    }
  }

  return {
    name,
    slug,
    description,
    systemPrompt: body,
    steps: null,
    allowedTools,
    parameters: null,
  };
}
