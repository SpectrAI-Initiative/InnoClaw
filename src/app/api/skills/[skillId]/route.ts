import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, and, isNull, ne } from "drizzle-orm";

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
      updateData.slug = body.slug;

      // Validate slug uniqueness within the same scope
      const current = await db
        .select()
        .from(skills)
        .where(eq(skills.id, skillId))
        .limit(1);

      if (current.length > 0) {
        const workspaceId = current[0].workspaceId;
        const duplicates = await db
          .select()
          .from(skills)
          .where(
            and(
              eq(skills.slug, body.slug),
              workspaceId
                ? eq(skills.workspaceId, workspaceId)
                : isNull(skills.workspaceId),
              ne(skills.id, skillId)
            )
          )
          .limit(1);

        if (duplicates.length > 0) {
          return NextResponse.json(
            { error: "A skill with this slug already exists in the same scope" },
            { status: 409 }
          );
        }
      }
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
