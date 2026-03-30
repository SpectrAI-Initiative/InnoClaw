import { promises as fs } from "fs";
import path from "path";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { insertSkill, parseSkillMd } from "@/lib/db/skills-insert";
import { slugify } from "@/lib/utils/slugify";

const DEFAULT_SKILLS_DIR = path.join(process.cwd(), ".claude", "skills");

let syncPromise: Promise<void> | null = null;

async function syncProjectDefaultSkillsImpl(): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(DEFAULT_SKILLS_DIR, {
      withFileTypes: true,
      encoding: "utf8",
    });
  } catch {
    return;
  }

  const skillDirs = entries.filter((entry) => entry.isDirectory());
  if (skillDirs.length === 0) {
    return;
  }

  const existingGlobalSkills = await db
    .select({
      id: skills.id,
      slug: skills.slug,
    })
    .from(skills)
    .where(isNull(skills.workspaceId));

  const existingBySlug = new Map(
    existingGlobalSkills.map((row) => [row.slug, row.id])
  );

  for (const dir of skillDirs) {
    const skillMdPath = path.join(DEFAULT_SKILLS_DIR, dir.name, "SKILL.md");
    let content: string;

    try {
      content = await fs.readFile(skillMdPath, "utf-8");
    } catch {
      continue;
    }

    const parsed = parseSkillMd(content, dir.name);
    if (!parsed) {
      continue;
    }

    const normalizedSlug = slugify(parsed.slug);
    if (!normalizedSlug) {
      continue;
    }

    const existingId = existingBySlug.get(normalizedSlug);
    if (existingId) {
      await db
        .update(skills)
        .set({
          name: parsed.name,
          description: parsed.description || null,
          systemPrompt: parsed.systemPrompt,
          steps: parsed.steps ? JSON.stringify(parsed.steps) : null,
          allowedTools: parsed.allowedTools
            ? JSON.stringify(parsed.allowedTools)
            : null,
          parameters: parsed.parameters
            ? JSON.stringify(parsed.parameters)
            : null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(eq(skills.id, existingId), isNull(skills.workspaceId))
        );
      continue;
    }

    const insertedId = await insertSkill(parsed, null);
    if (insertedId) {
      existingBySlug.set(normalizedSlug, insertedId);
    }
  }
}

export async function ensureProjectDefaultSkills(): Promise<void> {
  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = syncProjectDefaultSkillsImpl()
    .catch((error) => {
      console.warn("[default-skills] Failed to sync project default skills:", error);
    })
    .finally(() => {
      syncPromise = null;
    });

  return syncPromise;
}
