import { NextRequest, NextResponse } from "next/server";
import { skillToMarkdown } from "@/lib/utils/skill-md";
import { requireSkillAccess } from "@/lib/auth/ownership";
import { jsonException } from "@/lib/api-errors";

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

    const row = access.skill;

    const skillData = {
      name: row.name,
      slug: row.slug,
      description: row.description,
      systemPrompt: row.systemPrompt,
      workspaceId: row.workspaceId,
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

    const markdown = skillToMarkdown(skillData);

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${row.slug || "SKILL"}.md"`,
      },
    });
  } catch (error) {
    return jsonException(error, "Failed to export skill");
  }
}
