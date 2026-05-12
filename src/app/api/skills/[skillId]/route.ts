import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, ne, and, isNull } from "drizzle-orm";
import { slugify } from "@/lib/utils/slugify";
import { parseSkillRow } from "@/lib/db/skills-utils";
import { requireSkillAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  try {
    const { skillId } = await params;
    const access = await requireSkillAccess(request, skillId);
    if (access instanceof NextResponse) {
      return access;
    }
    return NextResponse.json(parseSkillRow(access.skill));
  } catch (error) {
    return jsonException(error, "Failed to get skill");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  try {
    const { skillId } = await params;
    const access = await requireSkillAccess(request, skillId);
    if (access instanceof NextResponse) {
      return access;
    }
    const { skill: currentSkill } = access;
    const body = await request.json();

    // JSON-serialize nested fields before writing
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) {
      const normalizedSlug = slugify(body.slug);
      if (!normalizedSlug) {
        return jsonError("Invalid slug: slug must contain at least one alphanumeric character after normalization", 400);
      }

      const duplicate = await db
        .select()
        .from(skills)
        .where(
          and(
            eq(skills.slug, normalizedSlug),
            ne(skills.id, skillId),
            currentSkill.workspaceId
              ? eq(skills.workspaceId, currentSkill.workspaceId)
              : isNull(skills.workspaceId),
          ),
        )
        .limit(1);

      if (duplicate.length > 0) {
        return jsonError("A skill with this slug already exists in the same scope", 409);
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
      return jsonError("Skill not found", 404);
    }

    return NextResponse.json(parseSkillRow(updated[0]));
  } catch (error) {
    // Catch unique constraint violation from the DB index
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      return jsonError("A skill with this slug already exists in the same scope", 409);
    }
    return jsonException(error, "Failed to update skill");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  try {
    const { skillId } = await params;
    const access = await requireSkillAccess(request, skillId);
    if (access instanceof NextResponse) {
      return access;
    }

    await db.delete(skills).where(eq(skills.id, access.skill.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to delete skill");
  }
}
