import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, ne, and, isNull } from "drizzle-orm";
import { slugify } from "@/lib/utils/slugify";
import { parseSkillRow } from "@/lib/db/skills-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  try {
    const { skillId } = await params;

    const skill = await db
      .select()
      .from(skills)
      .where(eq(skills.id, skillId))
      .limit(1);

    if (skill.length === 0) {
      return NextResponse.json(
        { error: "Skill not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(parseSkillRow(skill[0]));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get skill";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  try {
    const { skillId } = await params;
    const body = await request.json();

    // JSON-serialize nested fields before writing
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) {
      const normalizedSlug = slugify(body.slug);
      if (!normalizedSlug) {
        return NextResponse.json(
          { error: "Invalid slug: slug must contain at least one alphanumeric character after normalization" },
          { status: 400 }
        );
      }

      // Get the existing skill to determine scope for uniqueness check
      const existingSkill = await db
        .select()
        .from(skills)
        .where(eq(skills.id, skillId))
        .limit(1);

      if (existingSkill.length > 0) {
        const wid = existingSkill[0].workspaceId;
        const duplicate = await db
          .select()
          .from(skills)
          .where(
            and(
              eq(skills.slug, normalizedSlug),
              ne(skills.id, skillId),
              wid ? eq(skills.workspaceId, wid) : isNull(skills.workspaceId)
            )
          )
          .limit(1);

        if (duplicate.length > 0) {
          return NextResponse.json(
            { error: "A skill with this slug already exists in the same scope" },
            { status: 409 }
          );
        }
      }

      updateData.slug = normalizedSlug;
    }
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.systemPrompt !== undefined)
      updateData.systemPrompt = body.systemPrompt;
    if (body.steps !== undefined)
      updateData.steps = body.steps ? JSON.stringify(body.steps) : null;
    if (body.allowedTools !== undefined)
      updateData.allowedTools = body.allowedTools
        ? JSON.stringify(body.allowedTools)
        : null;
    if (body.parameters !== undefined)
      updateData.parameters = body.parameters
        ? JSON.stringify(body.parameters)
        : null;
    if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled;

    // Check slug uniqueness when slug is being updated
    if (body.slug !== undefined) {
      const current = await db
        .select()
        .from(skills)
        .where(eq(skills.id, skillId))
        .limit(1);

      if (current.length > 0) {
        const workspaceId = current[0].workspaceId;
        const existing = await db
          .select()
          .from(skills)
          .where(
            and(
              eq(skills.slug, body.slug),
              workspaceId
                ? eq(skills.workspaceId, workspaceId)
                : isNull(skills.workspaceId)
            )
          )
          .limit(1);

        if (existing.length > 0 && existing[0].id !== skillId) {
          return NextResponse.json(
            { error: "A skill with this slug already exists in the same scope" },
            { status: 409 }
          );
        }
      }
    }

    await db
      .update(skills)
      .set(updateData)
      .where(eq(skills.id, skillId));

    const updated = await db
      .select()
      .from(skills)
      .where(eq(skills.id, skillId))
      .limit(1);

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Skill not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(parseSkillRow(updated[0]));
  } catch (error) {
    // Catch unique constraint violation from the DB index
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      return NextResponse.json(
        { error: "A skill with this slug already exists in the same scope" },
        { status: 409 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to update skill";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  try {
    const { skillId } = await params;

    await db.delete(skills).where(eq(skills.id, skillId));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete skill";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
