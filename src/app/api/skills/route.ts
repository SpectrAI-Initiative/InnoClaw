import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, or, isNull, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

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

// GET /api/skills?workspaceId=xxx
// Returns global skills + workspace-specific skills
export async function GET(request: NextRequest) {
  try {
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
    const message =
      error instanceof Error ? error.message : "Failed to list skills";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/skills
export async function POST(request: NextRequest) {
  try {
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

    if (!name || !slug || !systemPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: name, slug, systemPrompt" },
        { status: 400 }
      );
    }

    const normalizedSlug = slugify(slug);

    if (!normalizedSlug) {
      return NextResponse.json(
        { error: "Invalid slug: slug must contain at least one alphanumeric character after normalization" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "A skill with this slug already exists in the same scope" },
        { status: 409 }
      );
    }

    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(skills).values({
      id,
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
    const message =
      error instanceof Error ? error.message : "Failed to create skill";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
