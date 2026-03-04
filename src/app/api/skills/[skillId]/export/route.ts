import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { SkillExportData } from "@/types";

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

    const row = skill[0];

    const exportData: SkillExportData = {
      name: row.name,
      slug: row.slug,
      description: row.description,
      systemPrompt: row.systemPrompt,
      steps: typeof row.steps === "string" ? JSON.parse(row.steps) : null,
      allowedTools:
        typeof row.allowedTools === "string"
          ? JSON.parse(row.allowedTools)
          : null,
      parameters:
        typeof row.parameters === "string"
          ? JSON.parse(row.parameters)
          : null,
      version: "1.0",
    };

    return NextResponse.json(exportData);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export skill";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
