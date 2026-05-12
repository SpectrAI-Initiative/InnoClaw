import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, or, isNull, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { slugify } from "@/lib/utils/slugify";
import { parseSkillRow } from "@/lib/db/skills-utils";
import { ensureProjectDefaultSkills } from "@/lib/db/default-skills";
import { requireWorkspaceAccess } from "@/lib/auth/ownership";
import { requireAuth } from "@/lib/auth/server";
import { jsonError, jsonException } from "@/lib/api-errors";

// GET /api/skills?workspaceId=xxx
// Returns global skills + workspace-specific skills
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    await ensureProjectDefaultSkills();

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    let allSkills;
    if (workspaceId) {
      allSkills = await db
        .select()
        .from(skills)
        .where(
          or(
            isNull(skills.workspaceId),
            eq(skills.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(skills.createdAt));
    } else {
      allSkills = await db
        .select()
        .from(skills)
        .where(isNull(skills.workspaceId))
        .orderBy(desc(skills.createdAt));
    }

    const parsed = allSkills.map(parseSkillRow);
    return NextResponse.json(parsed);
  } catch (error) {
    return jsonException(error, "Failed to list skills");
  }
}

// POST /api/skills
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const body = await request.json();
    const {
      workspaceId,
      name,
      slug,
      description,
      systemPrompt,
      steps,
      allowedTools,
      parameters,
    } = body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof slug !== "string" ||
      !slug.trim() ||
      typeof systemPrompt !== "string" ||
      !systemPrompt.trim()
    ) {
      return jsonError("Missing required fields: name, slug, systemPrompt", 400);
    }

    const normalizedSlug = slugify(slug);

    if (!normalizedSlug) {
      return jsonError("Invalid slug: slug must contain at least one alphanumeric character after normalization", 400);
    }

    // Validate workspace exists if workspaceId is provided
    if (workspaceId) {
      const access = await requireWorkspaceAccess(request, workspaceId);
      if (access instanceof NextResponse) {
        return access;
      }
    }

    // Check slug uniqueness within same scope
    const existing = await db
      .select()
      .from(skills)
      .where(
        and(
          eq(skills.slug, normalizedSlug),
          workspaceId
            ? eq(skills.workspaceId, workspaceId)
            : isNull(skills.workspaceId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return jsonError("A skill with this slug already exists in the same scope", 409);
    }

    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(skills).values({
      id,
      ownerUserId: auth.user.id,
      workspaceId: workspaceId || null,
      name,
      slug: normalizedSlug,
      description: description || null,
      systemPrompt,
      steps: steps ? JSON.stringify(steps) : null,
      allowedTools: allowedTools ? JSON.stringify(allowedTools) : null,
      parameters: parameters ? JSON.stringify(parameters) : null,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    });

    const skill = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id))
      .limit(1);

    return NextResponse.json(parseSkillRow(skill[0]), { status: 201 });
  } catch (error) {
    return jsonException(error, "Failed to create skill");
  }
}
